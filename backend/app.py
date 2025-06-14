from flask import Flask, jsonify, request, send_from_directory
import os
import math
from scipy.stats import norm, poisson, kstest, chi2_contingency, chisquare
import numpy as np # Importar numpy para operaciones con arrays

app = Flask(__name__, static_folder='../frontend/dist', static_url_path='/')

# Ruta para servir los archivos estáticos de React (después de la construcción)
@app.route('/')
def serve_react_app():
    return send_from_directory(app.static_folder, 'index.html')

@app.route('/api/hello')
def hello():
    return jsonify(message="Hola desde el Backend de Flask!")

@app.route('/api/generate_distribution_data', methods=['POST'])
def generate_distribution_data():
    data = request.get_json()
    distribution_type = data.get('distributionType')
    
    labels = []
    probabilities = []

    if distribution_type == 'poisson':
        try:
            lambda_val = float(data.get('lambda'))
            max_k = max(15, math.ceil(lambda_val * 3) + 2) 
            for k in range(0, max_k + 1):
                prob = poisson.pmf(k, lambda_val) # Usamos scipy.stats.poisson.pmf
                labels.append(str(k))
                probabilities.append(prob)
        except (ValueError, TypeError):
            return jsonify({"error": "Parámetros de Poisson inválidos"}), 400

    elif distribution_type == 'normal':
        try:
            mean_val = float(data.get('mean'))
            std_dev_val = float(data.get('stdDev'))
            
            min_x = mean_val - 4 * std_dev_val
            max_x = mean_val + 4 * std_dev_val
            num_points = 100 
            
            for i in range(num_points + 1):
                x = min_x + (max_x - min_x) * i / num_points
                prob = norm.pdf(x, loc=mean_val, scale=std_dev_val)
                labels.append(f"{x:.2f}")
                probabilities.append(prob)
        except (ValueError, TypeError):
            return jsonify({"error": "Parámetros de Normal inválidos"}), 400

    else:
        return jsonify({"error": "Tipo de distribución no soportado"}), 400

    return jsonify({
        "labels": labels,
        "data": probabilities
    })

# --- NUEVAS RUTAS API PARA PRUEBAS DE BONDAD DE AJUSTE ---

@app.route('/api/run_goodness_of_fit_test', methods=['POST'])
def run_goodness_of_fit_test():
    data = request.get_json()
    test_type = data.get('testType')
    observed_data = data.get('observedData') # [345, 310, ..., 0]
    distribution_type = data.get('distributionType') # 'poisson' o 'normal'
    
    # Parámetros de la distribución teórica
    lambda_val = data.get('lambda')
    mean_val = data.get('mean')
    std_dev_val = data.get('stdDev')

    results = {
        "testType": test_type,
        "distributionType": distribution_type,
        "statistic": None,
        "pValue": None,
        "conclusion": "No se pudo realizar la prueba.",
        "details": {}
    }

    # Suma total de los abandonos observados (para escalar las probabilidades teóricas)
    total_observed_count = sum(observed_data)
    if total_observed_count == 0:
        results["conclusion"] = "No hay abandonos observados para analizar."
        return jsonify(results)

    # Convertir a numpy array para facilitar operaciones
    observed_counts_np = np.array(observed_data)

    if distribution_type == 'poisson':
        if lambda_val is None:
            results["conclusion"] = "Lambda para Poisson no proporcionado."
            return jsonify(results)
        lambda_val = float(lambda_val)

        # Generar probabilidades esperadas para los k (semestres 1 a 10)
        # Note: Poisson PMF es para k=0, 1, 2... Nuestros datos empiezan en el semestre 1.
        # Asumimos que los datos observados corresponden a k=1, 2, ..., 10
        # P(X=0) es la probabilidad de 0 abandonos, que no está en tus datos por semestre.
        # Para la prueba, necesitamos los "conteo esperados" para cada "bin" (semestre).
        
        # Ajustamos los semestres de 1-10 a eventos k de 0-9 para poisson.pmf,
        # o generamos las probabilidades para 1-10 y sumamos P(X=0) si aplica.
        # Para Chi-cuadrado, necesitamos frecuencias para cada categoría (semestre).
        
        # Calculamos PMF para k=0, 1, ..., 10. Luego tomaremos de k=1 a k=10.
        poisson_pmfs_all_k = [poisson.pmf(k, lambda_val) for k in range(len(observed_data) + 1)] # P(X=0) a P(X=10)
        
        # Las probabilidades para k=1 a k=10
        expected_probs = poisson_pmfs_all_k[1:] # Ignorar P(X=0) si tus datos observados empiezan en semestre 1
        
        # Calcular frecuencias esperadas
        expected_counts = np.array(expected_probs) * total_observed_count
        
        # --- Manejo de la agrupación para Chi-cuadrado ---
        # Asegurarse de que no haya frecuencias esperadas muy bajas
        # Esto es CRÍTICO para Chi-cuadrado.
        
        # Crear bins y agrupar si las frecuencias esperadas son menores a 5
        # Vamos a agrupar los últimos semestres hasta que la suma de esperados sea >= 5
        
        grouped_observed = []
        grouped_expected = []
        current_observed_group = 0
        current_expected_group = 0
        
        for i in range(len(observed_data)):
            if expected_counts[i] < 5:
                current_observed_group += observed_counts_np[i]
                current_expected_group += expected_counts[i]
                
                # Si estamos en la última categoría o el grupo ya es >= 5
                # y no es la primera categoría (para evitar agrupar solo una y que sea pequeña)
                if i == len(observed_data) - 1 or current_expected_group >= 5:
                    grouped_observed.append(current_observed_group)
                    grouped_expected.append(current_expected_group)
                    current_observed_group = 0
                    current_expected_group = 0
            else:
                if current_expected_group > 0: # Si hay un grupo acumulado antes de una categoría grande
                    grouped_observed.append(current_observed_group)
                    grouped_expected.append(current_expected_group)
                grouped_observed.append(observed_counts_np[i])
                grouped_expected.append(expected_counts[i])
                current_observed_group = 0
                current_expected_group = 0
        
        # Asegurarse de que el último grupo acumulado se añada si existe
        if current_expected_group > 0:
             grouped_observed.append(current_observed_group)
             grouped_expected.append(current_expected_group)

        # Convertir a numpy arrays
        grouped_observed_np = np.array(grouped_observed)
        grouped_expected_np = np.array(grouped_expected)
        
        # Ajustar para el caso donde sumamos P(X=0) para la prueba KS si los datos son acumulativos
        # Para Chi-cuadrado, es mejor trabajar con los bins de frecuencia.
        
    elif distribution_type == 'normal':
        if mean_val is None or std_dev_val is None:
            results["conclusion"] = "Media o Desviación Estándar para Normal no proporcionados."
            return jsonify(results)
        mean_val = float(mean_val)
        std_dev_val = float(std_dev_val)

        # Para Normal, los datos de "semestres" son discretos, pero la distribución Normal es continua.
        # Necesitamos calcular la probabilidad de cada "bin" (semestre) bajo la curva Normal.
        # P(semestre 1) = P(0.5 < X <= 1.5), P(semestre 2) = P(1.5 < X <= 2.5), etc.
        # Usaremos la CDF (Función de Distribución Acumulada) de la Normal: norm.cdf(x, loc, scale)
        
        # Probabilidades teóricas para cada semestre (bin)
        expected_probs_normal = []
        # Asumiendo que el semestre 1 va de 0.5 a 1.5, el 2 de 1.5 a 2.5, etc.
        # Y que el semestre 10 incluye todo lo de 9.5 en adelante.
        
        # Probabilidad de P(X <= 0.5) para manejar el inicio
        prob_up_to_0_5 = norm.cdf(0.5, loc=mean_val, scale=std_dev_val)
        
        # P(1er Semestre) = P(X <= 1.5) - P(X <= 0.5)
        # P(2do Semestre) = P(X <= 2.5) - P(X <= 1.5)
        # ...
        # P(9no Semestre) = P(X <= 9.5) - P(X <= 8.5)
        # P(10mo Semestre) = 1 - P(X <= 9.5) (incluye todo lo posterior)

        prev_cdf = prob_up_to_0_5
        for i in range(1, len(observed_data)): # Semestres 1 a 9
            current_upper_bound = i + 0.5
            current_cdf = norm.cdf(current_upper_bound, loc=mean_val, scale=std_dev_val)
            expected_probs_normal.append(current_cdf - prev_cdf)
            prev_cdf = current_cdf
        
        # Última categoría (10mo semestre y más allá)
        expected_probs_normal.append(1 - prev_cdf) # P(X > 9.5)

        # Asegurarse de que la suma de expected_probs_normal sea 1 (o muy cerca)
        sum_expected_probs = sum(expected_probs_normal)
        if sum_expected_probs > 0: # Normalizar si no suma 1
             expected_probs_normal = [p / sum_expected_probs for p in expected_probs_normal]

        expected_counts = np.array(expected_probs_normal) * total_observed_count

        # Para Normal, también necesitamos agrupar para Chi-cuadrado si E_i < 5
        grouped_observed = []
        grouped_expected = []
        current_observed_group = 0
        current_expected_group = 0
        
        for i in range(len(observed_data)):
            if expected_counts[i] < 5:
                current_observed_group += observed_counts_np[i]
                current_expected_group += expected_counts[i]
                
                if i == len(observed_data) - 1 or current_expected_group >= 5:
                    grouped_observed.append(current_observed_group)
                    grouped_expected.append(current_expected_group)
                    current_observed_group = 0
                    current_expected_group = 0
            else:
                if current_expected_group > 0:
                    grouped_observed.append(current_observed_group)
                    grouped_expected.append(current_expected_group)
                grouped_observed.append(observed_counts_np[i])
                grouped_expected.append(expected_counts[i])
                current_observed_group = 0
                current_expected_group = 0
        
        if current_expected_group > 0:
             grouped_observed.append(current_observed_group)
             grouped_expected.append(current_expected_group)
        
        grouped_observed_np = np.array(grouped_observed)
        grouped_expected_np = np.array(grouped_expected)

    else:
        results["conclusion"] = "Tipo de distribución no soportado para la prueba."
        return jsonify(results)

    # --- Ejecutar la Prueba Seleccionada ---
    if test_type == 'chi_square':
        # La prueba de Chi-cuadrado opera sobre frecuencias observadas y esperadas
        # Asegurarse que las frecuencias esperadas sumen el total de observados para Chi-cuadrado
        # Normalizar si no es el caso, aunque con nuestra lógica de total_observed_count debería serlo.
        
        # Asegurarse de que no haya ceros en expected_counts_np (puede pasar después de agrupar si hay un bug)
        # Reemplazar ceros pequeños con un número muy pequeño si es necesario para evitar division by zero
        # Esto debería estar manejado por la agrupación
        
        # chisquare directamente compara observados y esperados
        try:
            stat, p_value = chisquare(f_obs=grouped_observed_np, f_exp=grouped_expected_np)
            df = len(grouped_observed_np) - 1 # k - 1 grados de libertad para Chi-cuadrado (k categorías)
            # Si se estima un parámetro (como lambda de los datos), sería df - 1
            # Pero aquí lambda es dado por el usuario.
            
            results["statistic"] = round(stat, 4)
            results["pValue"] = round(p_value, 4)
            results["details"]["degrees_of_freedom"] = df
            results["details"]["grouped_observed_counts"] = grouped_observed_np.tolist()
            results["details"]["grouped_expected_counts"] = grouped_expected_np.tolist()

            alpha = 0.05 # Nivel de significancia común
            if p_value < alpha:
                results["conclusion"] = f"Se rechaza la hipótesis nula (H0). Los datos observados NO se ajustan a una distribución {distribution_type.capitalize()} con los parámetros dados (p-valor = {p_value:.4f} < {alpha})."
            else:
                results["conclusion"] = f"No se rechaza la hipótesis nula (H0). Los datos observados PUEDEN ajustarse a una distribución {distribution_type.capitalize()} con los parámetros dados (p-valor = {p_value:.4f} >= {alpha})."
        except Exception as e:
            results["conclusion"] = f"Error al ejecutar la prueba Chi-cuadrado: {str(e)}"
            results["details"]["error_message"] = str(e)


    elif test_type == 'kolmogorov_smirnov':
        # La prueba K-S requiere datos como una muestra de valores individuales,
        # no frecuencias agrupadas directamente, y una CDF teórica.
        # Convertir tus "frecuencias por semestre" a una "muestra" para K-S es un poco complejo.
        # Una aproximación común es generar una muestra sintética basada en tus frecuencias.
        # Sin embargo, la K-S de SciPy `kstest` espera una lista de valores de una muestra.
        # Para datos discretos y frecuencias, es más común usarla para comparar contra la CDF.
        
        # Para Poisson, la CDF es poisson.cdf(k, lambda_val)
        # Para Normal, la CDF es norm.cdf(x, loc=mean_val, scale=std_dev_val)

        # K-S es para variables continuas o discretas si se tratan los valores únicos.
        # Para frecuencias, se compara la CDF empírica (Fn(x)) vs teórica (F0(x)).
        
        # Vamos a construir la CDF empírica de tus datos observados
        # Los 'k' son los semestres 1 a 10.
        labels_for_cdf = np.arange(1, len(observed_data) + 1) # [1, 2, ..., 10]
        
        # Frecuencia relativa (PMF empírica)
        observed_relative_freq = observed_counts_np / total_observed_count
        
        # CDF Empírica
        empirical_cdf = np.cumsum(observed_relative_freq)

        # CDF Teórica
        theoretical_cdf = []
        if distribution_type == 'poisson':
            # P(X<=k) para k=1 a 10 (con lambda)
            theoretical_cdf = [poisson.cdf(k_val, lambda_val) for k_val in labels_for_cdf]
        elif distribution_type == 'normal':
            # P(X<=k.5) para k=1 a 10, donde k.5 es el límite superior del bin del semestre.
            theoretical_cdf = [norm.cdf(k_val + 0.5, loc=mean_val, scale=std_dev_val) for k_val in labels_for_cdf]
            # Asegurarse de que la CDF teórica no exceda 1.0 al final debido a redondeo
            theoretical_cdf = np.clip(theoretical_cdf, 0, 1) 
        
        # Calcular la estadística D de K-S
        # D es el máximo absoluto de las diferencias entre las CDFs
        d_stat = np.max(np.abs(empirical_cdf - np.array(theoretical_cdf)))
        
        # Para obtener el p-valor de K-S con datos de frecuencias/agrupados,
        # SciPy kstest espera una muestra. Tendríamos que "desagrupar" los datos
        # en una lista de observaciones individuales si queremos usar kstest directamente.
        # Por ejemplo: [1, 1, 1, ..., 2, 2, ..., 10, 10] (donde 1 aparece 345 veces, 2 310 veces, etc.)
        # Eso sería una lista GIGANTE (1064 elementos), lo que es ineficiente y no es la forma ideal de usar kstest
        # para datos binned/frecuencias.
        
        # Una forma más apropiada es usar el p-valor calculado de una tabla K-S o una fórmula aproximada.
        # SciPy `kstest` asume una muestra de datos individuales contra una distribución teórica.
        # Para este caso, podemos usar una aproximación de p-valor o simplemente reportar D y la regla de decisión.
        # Dado que `kstest` no es directamente aplicable a datos ya binneados para la CDF de esa manera sin una muestra,
        # vamos a calcular D y luego dar una conclusión basada en D vs valor crítico.
        # O, si queremos un p-valor, tendríamos que generar la muestra:
        
        # Generar muestra_sintetica (si es factible por tamaño)
        synthetic_sample = []
        for i, count in enumerate(observed_data):
            synthetic_sample.extend([i + 1] * count) # Repite el semestre 'i+1' 'count' veces

        # Si la muestra es muy grande (ej. más de 2000-5000 puntos), kstest puede ser lento.
        # Para 1064 puntos, es factible.
        if distribution_type == 'poisson':
            # Para Poisson, la distribución es discreta. kstest puede ser menos potente.
            # Aquí, probamos si la muestra de semestres observados sigue una Poisson.
            stat, p_value = kstest(synthetic_sample, lambda x: poisson.cdf(x, lambda_val))
        elif distribution_type == 'normal':
            # Para Normal, la distribución es continua.
            stat, p_value = kstest(synthetic_sample, 'norm', args=(mean_val, std_dev_val))

        results["statistic"] = round(stat, 4)
        results["pValue"] = round(p_value, 4)
        results["details"]["d_statistic"] = round(d_stat, 4) # También reportar la D calculada directamente
        
        alpha = 0.05
        if p_value < alpha:
            results["conclusion"] = f"Se rechaza la hipótesis nula (H0). Los datos observados NO se ajustan a una distribución {distribution_type.capitalize()} con los parámetros dados (p-valor = {p_value:.4f} < {alpha})."
        else:
            results["conclusion"] = f"No se rechaza la hipótesis nula (H0). Los datos observados PUEDEN ajustarse a una distribución {distribution_type.capitalize()} con los parámetros dados (p-valor = {p_value:.4f} >= {alpha})."
        
    else:
        results["conclusion"] = "Tipo de prueba no soportado o error en parámetros."
        return jsonify(results)

    return jsonify(results)


if __name__ == '__main__':
    app.run(debug=True, port=5000)