import React, { useState, useEffect } from 'react';
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
  // --- Estado para la sección de distribuciones teóricas ---
  const [distributionType, setDistributionType] = useState('poisson');
  const [lambda, setLambda] = useState(2);
  const [mean, setMean] = useState(0);
  const [stdDev, setStdDev] = useState(1);
  const [chartData, setChartData] = useState({});
  const [chartOptions, setChartOptions] = useState({});
  const [currentChartComponent, setCurrentChartComponent] = useState(Bar);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // --- NUEVOS Estados para la sección de datos de abandono reales ---
  // Inicializamos con los datos que me proporcionaste como ejemplo
  const [observedAbandonmentData, setObservedAbandonmentData] = useState(
    [345, 310, 232, 108, 49, 13, 6, 1, 0, 0]
  );
  const [observedChartData, setObservedChartData] = useState({});
  const [observedChartOptions, setObservedChartOptions] = useState({});


  // Función para obtener datos de distribución del backend
  const generateChartData = async () => {
    setLoading(true);
    setError(null);

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

      const data = await response.json();

      setCurrentChartComponent(distributionType === 'poisson' ? Bar : Line);
      
      const titleText = distributionType === 'poisson' 
        ? `Distribución de Poisson (λ = ${lambda})`
        : `Distribución Normal (μ = ${mean}, σ = ${stdDev})`;

      setChartData({
        labels: data.labels,
        datasets: [
          {
            label: 'Probabilidad',
            data: data.data,
            backgroundColor: distributionType === 'poisson' ? 'rgba(75, 192, 192, 0.6)' : 'rgba(153, 102, 255, 0.6)',
            borderColor: distributionType === 'poisson' ? 'rgba(75, 192, 192, 1)' : 'rgba(153, 102, 255, 1)',
            borderWidth: 1,
            pointRadius: distributionType === 'poisson' ? 5 : 0,
            fill: false,
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
      setError(err.message);
      setChartData({});
    } finally {
      setLoading(false);
    }
  };

  // --- NUEVA Función para generar la gráfica de datos de abandono observados ---
  const generateObservedChart = () => {
    const labels = Array.from({ length: 10 }, (_, i) => `${i + 1}º Semestre`);
    
    setObservedChartData({
      labels: labels,
      datasets: [
        {
          label: 'Estudiantes que Abandonaron',
          data: observedAbandonmentData,
          backgroundColor: 'rgba(255, 99, 132, 0.6)',
          borderColor: 'rgba(255, 99, 132, 1)',
          borderWidth: 1,
        },
      ],
    });

    setObservedChartOptions({
      responsive: true,
      plugins: {
        legend: {
          position: 'top',
        },
        title: {
          display: true,
          text: 'Cantidad de Estudiantes que Abandonaron por Semestre (Datos Ingresados)',
        },
      },
      scales: {
        x: {
          title: {
            display: true,
            text: 'Nivel de Semestre',
          },
        },
        y: {
          title: {
            display: true,
            text: 'Cantidad de Estudiantes',
          },
          beginAtZero: true,
        },
      },
      animation: {
        duration: 0
      }
    });
  };


  // --- NUEVA Función para manejar cambios en los inputs de abandono ---
  const handleObservedDataChange = (index, value) => {
    const newObservedData = [...observedAbandonmentData];
    newObservedData[index] = Number(value); // Asegurarse de que sea un número
    setObservedAbandonmentData(newObservedData);
  };

  // useEffects para actualizar gráficas automáticamente
  useEffect(() => {
    generateChartData();
  }, [distributionType, lambda, mean, stdDev]);

  useEffect(() => {
    generateObservedChart();
  }, [observedAbandonmentData]); // Se actualiza cada vez que cambian los datos observados


  // Renderizado del componente
  const ChartComponent = currentChartComponent;
  
  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h1>Modelado y Simulación de Deserción Estudiantil</h1>

      {/* Sección 1: Generación y Visualización de Distribuciones Teóricas */}
      <section style={{ marginBottom: '40px', border: '1px solid #ccc', padding: '20px', borderRadius: '8px' }}>
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

      {/* Sección 2: Análisis de Datos de Abandono Reales */}
      <section style={{ border: '1px solid #ccc', padding: '20px', borderRadius: '8px' }}>
        <h2>Análisis de Datos de Abandono por Semestre (Datos Observados)</h2>
        <p>Introduce la cantidad de estudiantes que abandonaron por cada semestre (del 1º al 10º).</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '10px', maxWidth: '800px', margin: '0 auto' }}>
          {observedAbandonmentData.map((count, index) => (
            <div key={index} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <label>
                {index + 1}º Semestre:
                <input
                  type="number"
                  value={count}
                  onChange={(e) => handleObservedDataChange(index, e.target.value)}
                  min="0"
                  style={{ width: '80px', textAlign: 'center' }}
                />
              </label>
            </div>
          ))}
        </div>
        
        {/* El botón de "Graficar" ya no es estrictamente necesario si usamos useEffect, pero podemos mantenerlo si queremos un control manual */}
        {/* <button onClick={generateObservedChart} style={{ marginTop: '20px', padding: '10px 20px', fontSize: '16px' }}>
          Graficar Datos de Abandono
        </button> */}

        <div style={{ width: '70%', margin: '20px auto' }}>
          {observedChartData.datasets && observedChartData.datasets[0] && observedChartData.datasets[0].data.length > 0 && (
            <Bar data={observedChartData} options={observedChartOptions} />
          )}
        </div>

        {/* Aquí irán las opciones de prueba de bondad de ajuste en la siguiente fase */}
        <div style={{ marginTop: '20px' }}>
            <h3>Pruebas de Bondad de Ajuste (Próximamente)</h3>
            <p>Selecciona una prueba para determinar si tus datos de abandono se ajustan a una distribución teórica.</p>
        </div>
      </section>
    </div>
  );
}

export default App;