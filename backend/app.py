from flask import Flask, jsonify, request, send_from_directory
import os
import math
from scipy.stats import norm, poisson, kstest, chisquare
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
            # Generar k desde 0 hasta un valor razonable (ej. lambda * 3 o 15), ajustado para asegurar visibilidad de la cola
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

# --- RUTAS API PARA PRUEBAS DE BONDAD DE AJUSTE ---

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
        results["conclusion"] = "No hay abandonos observados para analizar (suma total es 0)."
        return jsonify(results)

    # Convertir a numpy array para facilitar operaciones
    observed_counts_np = np.array(observed_data)
    
    # --- Generación de frecuencias esperadas y agrupación para Chi-cuadrado ---
    # Esto se hará siempre, ya que es la base para ambas pruebas o para los detalles
    
    expected_pmfs = [] # Probabilidad puntual teórica para cada semestre
    
    if distribution_type == 'poisson':
        if lambda_val is None:
            results["conclusion"] = "Lambda para Poisson no proporcionado."
            return jsonify(results)
        lambda_val = float(lambda_val)
        
        # Calcular PMF para k=1, 2, ..., 10 (que son los semestres)
        # Note: poisson.pmf(0, lambda_val) es P(X=0). Si nuestros semestres son 1-10, no incluimos k=0.
        # Si la prueba K-S va a generar una muestra, esta muestra tendrá valores 1 a 10.
        for k_semestre in range(1, len(observed_data) + 1): # Semestres 1 a 10
            expected_pmfs.append(poisson.pmf(k_semestre, lambda_val))
        
        # Ajustar la suma de PMFs para el caso discreto si es necesario para que sumen 1
        # La suma de PMFs de Poisson hasta cierto punto no suma 1.0.
        # Para Chi-cuadrado, necesitamos frecuencias esperadas que sumen total_observed_count.
        # La cola de la distribución de Poisson puede extenderse mucho.
        # Es mejor usar poisson.cdf para calcular la probabilidad de "bins" discretos.
        
        # Recalculemos las PMFs, incluyendo P(X=0) y asegurando que las sumas finales
        # de los bins esperados cubran 100% de la probabilidad para Chi-cuadrado
        
        # Probabilidades para k=0, 1, ..., 9 (equivalente a los semestres 1-10 en tus datos)
        # Asumimos que tus datos de semestre 1 corresponden a k=0 en Poisson, etc.
        # Esto es clave: "semestre 1" (observado) se compara con "0 eventos" (Poisson)
        # O "semestre 1" es "1 evento", "semestre 2" es "2 eventos", etc.
        # La última interpretación es más común para "conteo de eventos por semestre".
        # Si es "conteo de abandonos en el semestre X", entonces Semestre 1 = k=1
        # Vamos a seguir la interpretación de "Semestre N" significa "N eventos".
        
        # Expected PMFs para k=1 a k=10
        raw_expected_pmfs = [poisson.pmf(k_val, lambda_val) for k_val in range(1, len(observed_data) + 1)]
        
        # Para chi-cuadrado, es mejor calcular las probabilidades de los bins que están en tus datos
        # Y la probabilidad de la 'cola' si es que el último bin observado es un 'y más'.
        
        # Este es un punto de ambigüedad. Si "semestre 1" significa 1 evento en Poisson,
        # entonces el rango de k para Poisson debe ser 1 a 10.
        # Si los semestres 1-10 son simplemente categorías, y la distribución de Poisson
        # modela la "posición del abandono", entonces k puede empezar en 0.
        # Asumamos que Semestre N corresponde a k=N en la distribución de Poisson.
        
        # Probabilidades de P(X=1), P(X=2), ..., P(X=9), y P(X >= 10) para el último bin.
        poisson_probs_bins = [poisson.pmf(k, lambda_val) for k in range(1, len(observed_data))] # P(X=1) to P(X=9)
        poisson_probs_bins.append(1 - poisson.cdf(len(observed_data) - 1, lambda_val)) # P(X >= 10)
        
        expected_counts = np.array(poisson_probs_bins) * total_observed_count

    elif distribution_type == 'normal':
        if mean_val is None or std_dev_val is None:
            results["conclusion"] = "Media o Desviación Estándar para Normal no proporcionados."
            return jsonify(results)
        mean_val = float(mean_val)
        std_dev_val = float(std_dev_val)

        # Calculamos la probabilidad de cada bin (semestre) bajo la curva Normal
        expected_probs_normal = []
        
        # Probabilidad de P(X <= 0.5) para manejar el inicio antes del semestre 1
        prob_up_to_0_5 = norm.cdf(0.5, loc=mean_val, scale=std_dev_val)
        
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
        if sum_expected_probs > 0: # Normalizar si no suma 1 (debido a errores de flotante)
             expected_probs_normal = np.array(expected_probs_normal) / sum_expected_probs
        else:
             results["conclusion"] = "Suma de probabilidades esperadas es cero. Parámetros Normales podrían ser inadecuados."
             return jsonify(results)

        expected_counts = expected_probs_normal * total_observed_count

    else:
        results["conclusion"] = "Tipo de distribución no soportado para la prueba."
        return jsonify(results)

    # --- Agrupación de categorías para Chi-cuadrado y K-S (si se genera muestra) ---
    # Esta función agrupará los datos para asegurar que las frecuencias esperadas >= 5
    def group_categories(obs_counts, exp_counts):
        grouped_obs = []
        grouped_exp = []
        current_obs_group = 0
        current_exp_group = 0

        for i in range(len(obs_counts)):
            # Si la frecuencia esperada actual es menor a 5, agrupar
            if exp_counts[i] < 5:
                current_obs_group += obs_counts[i]
                current_exp_group += exp_counts[i]
                
                # Si es la última categoría O el grupo acumulado ya es >= 5, entonces cerrar el grupo
                if i == len(obs_counts) - 1 or current_exp_group >= 5:
                    grouped_obs.append(current_obs_group)
                    grouped_exp.append(current_exp_group)
                    current_obs_group = 0
                    current_exp_group = 0
            else:
                # Si hay un grupo acumulado y la categoría actual es grande, cerrar el grupo acumulado
                if current_exp_group > 0:
                    grouped_obs.append(current_obs_group)
                    grouped_exp.append(current_exp_group)
                    current_obs_group = 0
                    current_exp_group = 0
                # Añadir la categoría actual directamente
                grouped_obs.append(obs_counts[i])
                grouped_exp.append(exp_counts[i])
        
        # Asegurarse de que el último grupo acumulado se añada si existe
        if current_exp_group > 0:
            grouped_obs.append(current_obs_group)
            grouped_exp.append(current_exp_group)
            
        return np.array(grouped_obs), np.array(grouped_exp)

    # Aplicar la agrupación
    grouped_observed_np, grouped_expected_np = group_categories(observed_counts_np, expected_counts)
    
    # Asegurar que no haya ceros en las frecuencias esperadas después de agrupar para evitar NaNs
    # Reemplazar 0s con un valor muy pequeño (ej. 1e-10) si persiste, aunque la agrupación debería evitarlo
    # Si sum(grouped_expected_np) es 0 o muy cercano a 0, eso es un problema de parámetros.
    if np.sum(grouped_expected_np) == 0:
        results["conclusion"] = "Las frecuencias esperadas agrupadas son cero. Parámetros de distribución podrían ser extremos."
        return jsonify(results)

    # --- Ejecutar la Prueba Seleccionada ---
    if test_type == 'chi_square':
        try:
            # chisquare directamente compara observados y esperados
            # Asegúrate de que las sumas sean iguales o casi iguales, scipy puede normalizar.
            stat, p_value = chisquare(f_obs=grouped_observed_np, f_exp=grouped_expected_np)
            df = len(grouped_observed_np) - 1 
            # Si se estimara un parámetro de la distribución (ej. lambda de los datos), se restaría 1 grado de libertad adicional.
            # Aquí, lambda es un parámetro dado por el usuario, por lo que no se resta.
            
            # Asegurar que el estadístico y p-valor no sean NaN si hay problemas con los datos
            if np.isnan(stat) or np.isnan(p_value):
                 results["conclusion"] = "Error de cálculo: Estadístico o P-valor Chi-cuadrado resultó en NaN."
                 return jsonify(results)

            results["statistic"] = round(stat, 4)
            results["pValue"] = round(p_value, 4)
            results["details"]["degrees_of_freedom"] = df
            results["details"]["grouped_observed_counts"] = grouped_observed_np.tolist()
            results["details"]["grouped_expected_counts"] = grouped_expected_np.tolist()

            alpha = 0.05
            if p_value < alpha:
                results["conclusion"] = f"Se rechaza la hipótesis nula (H0). Los datos observados NO se ajustan a una distribución {distribution_type.capitalize()} con los parámetros dados (p-valor = {p_value:.4f} < {alpha})."
            else:
                results["conclusion"] = f"No se rechaza la hipótesis nula (H0). Los datos observados PUEDEN ajustarse a una distribución {distribution_type.capitalize()} con los parámetros dados (p-valor = {p_value:.4f} >= {alpha})."
        except Exception as e:
            results["conclusion"] = f"Error al ejecutar la prueba Chi-cuadrado: {str(e)}"
            results["details"]["error_message"] = str(e)


    elif test_type == 'kolmogorov_smirnov':
        try:
            # Generar muestra_sintetica para K-S
            # Este es el punto crucial que podría causar problemas si la muestra se hace gigante
            # o si los valores de k para poisson/norm cdf no son adecuados.
            
            # synthetic_sample debe ser una lista de valores individuales (no frecuencias)
            synthetic_sample = []
            # 'i+1' para mapear el índice del array (0-9) a los semestres (1-10)
            for i, count in enumerate(observed_data): 
                if count > 0: # Evitar agregar ceros si no hay abandonos
                    # Agrega el número de semestre 'count' veces
                    # Por ejemplo, si semestre 1 tiene 345 abandonos, agrega 1 (345 veces)
                    synthetic_sample.extend([i + 1] * count) 
            
            if not synthetic_sample: # Si la muestra sintética está vacía (todos los abandonos son 0)
                results["conclusion"] = "No hay datos en la muestra observada para la prueba K-S."
                return jsonify(results)

            # Convertir a numpy array para kstest
            synthetic_sample_np = np.array(synthetic_sample)

            if distribution_type == 'poisson':
                # Para K-S de Poisson, se necesita una función que calcule la CDF de Poisson para los valores de la muestra.
                # kstest(sample, cdf_function, args)
                stat, p_value = kstest(synthetic_sample_np, lambda x: poisson.cdf(x, lambda_val))
            elif distribution_type == 'normal':
                # Para K-S de Normal, se usa el nombre de la distribución 'norm' y sus args
                stat, p_value = kstest(synthetic_sample_np, 'norm', args=(mean_val, std_dev_val))
            
            # Asegurar que el estadístico y p-valor no sean NaN si hay problemas con los datos
            if np.isnan(stat) or np.isnan(p_value):
                 results["conclusion"] = "Error de cálculo: Estadístico o P-valor K-S resultó en NaN."
                 return jsonify(results)


            results["statistic"] = round(stat, 4)
            results["pValue"] = round(p_value, 4)
            results["details"]["sample_size_ks"] = len(synthetic_sample_np)
            
            alpha = 0.05
            if p_value < alpha:
                results["conclusion"] = f"Se rechaza la hipótesis nula (H0). Los datos observados NO se ajustan a una distribución {distribution_type.capitalize()} con los parámetros dados (p-valor = {p_value:.4f} < {alpha})."
            else:
                results["conclusion"] = f"No se rechaza la hipótesis nula (H0). Los datos observados PUEDEN ajustarse a una distribución {distribution_type.capitalize()} con los parámetros dados (p-valor = {p_value:.4f} >= {alpha})."
        except Exception as e:
            results["conclusion"] = f"Error al ejecutar la prueba Kolmogorov-Smirnov: {str(e)}"
            results["details"]["error_message"] = str(e)
            import traceback
            results["details"]["traceback"] = traceback.format_exc() # Para depuración
        
    else:
        results["conclusion"] = "Tipo de prueba no soportado o error en parámetros."
        return jsonify(results)

    return jsonify(results)


if __name__ == '__main__':
    app.run(debug=True, port=5000)