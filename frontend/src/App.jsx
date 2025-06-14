import React, { useState, useEffect, useRef } from 'react';
import { Bar, Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

// Registrar los componentes necesarios de Chart.js
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

function App() {
  const [distributionType, setDistributionType] = useState('poisson');
  const [lambda, setLambda] = useState(2); // Valor predeterminado para Poisson
  const [mean, setMean] = useState(0);     // Valor predeterminado para Normal
  const [stdDev, setStdDev] = useState(1);  // Valor predeterminado para Normal
  const [chartData, setChartData] = useState({});
  const [chartOptions, setChartOptions] = useState({});
  const [currentChartComponent, setCurrentChartComponent] = useState(Bar);
  const [loading, setLoading] = useState(false); // Nuevo estado para indicar carga
  const [error, setError] = useState(null);       // Nuevo estado para errores



  const generateChartData = async () => { // Hacemos la función asíncrona para usar await
    setLoading(true); // Indicar que la carga ha comenzado
    setError(null);   // Limpiar errores previos

    let requestBody = { distributionType: distributionType };
    if (distributionType === 'poisson') {
      requestBody.lambda = lambda;
    } else { // Normal
      requestBody.mean = mean;
      requestBody.stdDev = stdDev;
    }

    try {
      const response = await fetch('/api/generate_distribution_data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al obtener datos de distribución.');
      }

      const data = await response.json(); // La respuesta del backend

      setCurrentChartComponent(distributionType === 'poisson' ? Bar : Line);
      
      const titleText = distributionType === 'poisson' 
        ? `Distribución de Poisson (λ = ${lambda})`
        : `Distribución Normal (μ = ${mean}, σ = ${stdDev})`;

      setChartData({
        labels: data.labels, // Usamos los labels y data del backend
        datasets: [
          {
            label: 'Probabilidad',
            data: data.data,
            backgroundColor: distributionType === 'poisson' ? 'rgba(75, 192, 192, 0.6)' : 'rgba(153, 102, 255, 0.6)',
            borderColor: distributionType === 'poisson' ? 'rgba(75, 192, 192, 1)' : 'rgba(153, 102, 255, 1)',
            borderWidth: 1,
            pointRadius: distributionType === 'poisson' ? 5 : 0,
            fill: false, // Para la línea normal, evita que se rellene debajo
          },
        ],
      });

      setChartOptions({
        responsive: true,
        plugins: {
          legend: {
            position: 'top',
          },
          title: {
            display: true,
            text: titleText,
          },
        },
        scales: {
          x: {
            title: {
              display: true,
              text: distributionType === 'poisson' ? 'Número de Eventos (k)' : 'Valor (x)',
            },
          },
          y: {
            title: {
              display: true,
              text: 'Probabilidad / Densidad',
            },
            beginAtZero: true,
          },
        },
        animation: {
          duration: 0
        }
      });

    } catch (err) {
      console.error("Error al generar datos de gráfico:", err);
      setError(err.message); // Mostrar el mensaje de error en la UI
      setChartData({}); // Limpiar el gráfico en caso de error
    } finally {
      setLoading(false); // La carga ha terminado
    }
  };

  useEffect(() => {
    generateChartData();
  }, [distributionType, lambda, mean, stdDev]);

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h1>Modelado y Simulación de Deserción Estudiantil</h1>

      <section>
        <h2>Generación y Visualización de Distribuciones Teóricas</h2>
        <div>
          <label>
            Selecciona Distribución:
            <select value={distributionType} onChange={(e) => setDistributionType(e.target.value)}>
              <option value="poisson">Poisson</option>
              <option value="normal">Normal</option>
            </select>
          </label>
        </div>

        {distributionType === 'poisson' && (
          <div style={{ marginTop: '10px' }}>
            <label>
              Lambda (λ):
              <input
                type="number"
                value={lambda}
                onChange={(e) => setLambda(Number(e.target.value))}
                min="0.1"
                step="0.1"
              />
            </label>
          </div>
        )}

        {distributionType === 'normal' && (
          <div style={{ marginTop: '10px' }}>
            <label>
              Media (μ):
              <input
                type="number"
                value={mean}
                onChange={(e) => setMean(Number(e.target.value))}
                step="0.1"
              />
            </label>
            <label style={{ marginLeft: '10px' }}>
              Desviación Estándar (σ):
              <input
                type="number"
                value={stdDev}
                onChange={(e) => setStdDev(Number(e.target.value))}
                min="0.1"
                step="0.1"
              />
            </label>
          </div>
        )}
        
        {loading && <p>Cargando datos de la distribución...</p>}
        {error && <p style={{ color: 'red' }}>Error: {error}</p>}
        
        <div style={{ width: '70%', margin: '20px auto' }}>
          {chartData.datasets && chartData.datasets[0] && chartData.datasets[0].data.length > 0 && (
            React.createElement(currentChartComponent, { data: chartData, options: chartOptions })
          )}
        </div>
      </section>

      <section style={{ marginTop: '40px' }}>
        <h2>Análisis de Datos de Abandono Reales (Próximamente)</h2>
        <p>Esta sección permitirá ingresar datos de abandono y realizar pruebas de bondad de ajuste.</p>
      </section>
    </div>
  );
}

export default App;