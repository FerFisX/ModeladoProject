from flask import Flask, jsonify, request, send_from_directory
import os
import math # Para math.exp y math.factorial
from scipy.stats import norm # Para la PDF normal, más precisa que implementarla manualmente

app = Flask(__name__, static_folder='../frontend/dist', static_url_path='/')

# Ruta para servir los archivos estáticos de React (después de la construcción)
@app.route('/')
def serve_react_app():
    return send_from_directory(app.static_folder, 'index.html')

# Ruta de ejemplo (mantener para pruebas si quieres)
@app.route('/api/hello')
def hello():
    return jsonify(message="Hola desde el Backend de Flask!")

# --- NUEVAS RUTAS API PARA CÁLCULO DE DISTRIBUCIONES ---

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
            max_k = max(15, math.ceil(lambda_val * 3) + 2) # Asegura que la cola sea visible
            for k in range(0, max_k + 1):
                prob = (math.exp(-lambda_val) * (lambda_val ** k)) / math.factorial(k)
                labels.append(str(k))
                probabilities.append(prob)
        except (ValueError, TypeError):
            return jsonify({"error": "Parámetros de Poisson inválidos"}), 400

    elif distribution_type == 'normal':
        try:
            mean_val = float(data.get('mean'))
            std_dev_val = float(data.get('stdDev'))
            
            # Generar puntos para la curva normal (ej. +/- 4 desviaciones estándar)
            min_x = mean_val - 4 * std_dev_val
            max_x = mean_val + 4 * std_dev_val
            num_points = 100 # Número de puntos para una curva suave
            
            for i in range(num_points + 1):
                x = min_x + (max_x - min_x) * i / num_points
                # Usar scipy.stats.norm.pdf para la densidad de probabilidad
                prob = norm.pdf(x, loc=mean_val, scale=std_dev_val)
                labels.append(f"{x:.2f}") # Formatear a 2 decimales
                probabilities.append(prob)
        except (ValueError, TypeError):
            return jsonify({"error": "Parámetros de Normal inválidos"}), 400

    else:
        return jsonify({"error": "Tipo de distribución no soportado"}), 400

    return jsonify({
        "labels": labels,
        "data": probabilities
    })

# --- Rutas para futuras fases ---
# @app.route('/api/run_chi_square_test', methods=['POST'])
# def run_chi_square_test():
#     pass

# @app.route('/api/run_ks_test', methods=['POST'])
# def run_ks_test():
#     pass


if __name__ == '__main__':
    # Asegúrate de que el entorno virtual esté activado para que esto funcione
    app.run(debug=True, port=5000)