from flask import Flask, jsonify, send_from_directory
import os

app = Flask(__name__, static_folder='../frontend/dist', static_url_path='/')

# Ruta para servir los archivos estáticos de React (después de la construcción)
@app.route('/')
def serve_react_app():
    return send_from_directory(app.static_folder, 'index.html')

# Ruta de ejemplo para probar la conexión con el backend
@app.route('/api/hello')
def hello():
    return jsonify(message="Hola desde el Backend de Flask!")

# Rutas para la lógica de distribuciones y pruebas (se implementarán en fases futuras)
# @app.route('/api/generate_poisson_data', methods=['POST'])
# def generate_poisson_data():
#     # Lógica futura para generar datos de Poisson
#     pass

# @app.route('/api/generate_normal_data', methods=['POST'])
# def generate_normal_data():
#     # Lógica futura para generar datos normales
#     pass

# @app.route('/api/run_chi_square_test', methods=['POST'])
# def run_chi_square_test():
#     # Lógica futura para prueba Chi-cuadrado
#     pass

# @app.route('/api/run_ks_test', methods=['POST'])
# def run_ks_test():
#     # Lógica futura para prueba K-S
#     pass


if __name__ == '__main__':
    # Asegúrate de que el entorno virtual esté activado para que esto funcione
    # En desarrollo, Flask se ejecuta en su propio puerto (ej. 5000)
    # React se ejecutará en otro puerto (ej. 5173 por Vite por defecto)
    # Necesitaremos configurar un proxy en Vite (Fase 1.2) o CORS en Flask (si no hay proxy)
    app.run(debug=True, port=5000)