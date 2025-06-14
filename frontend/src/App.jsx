import React, { useState, useEffect } from 'react';
import { Bar, Line } from 'react-chartjs-2';
import './App.css';
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

  // --- Estados para la sección de datos de abandono reales ---
  const [observedAbandonmentData, setObservedAbandonmentData] = useState(
    [345, 310, 232, 108, 49, 13, 6, 1, 0, 0]
  );
  const [observedChartData, setObservedChartData] = useState({});
  const [observedChartOptions, setObservedChartOptions] = useState({});

  // --- Estados para las pruebas de bondad de ajuste ---
  const [testType, setTestType] = useState('chi_square'); // 'chi_square' o 'kolmogorov_smirnov'
  const [testResults, setTestResults] = useState(null);
  const [testLoading, setTestLoading] = useState(false);
  const [testError, setTestError] = useState(null);


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

  const handleObservedDataChange = (index, value) => {
    const newObservedData = [...observedAbandonmentData];
    newObservedData[index] = Number(value);
    setObservedAbandonmentData(newObservedData);
  };

  const runGoodnessOfFitTest = async () => {
    setTestLoading(true);
    setTestError(null);
    setTestResults(null); // Limpiar resultados anteriores

    let requestBody = {
      testType: testType,
      observedData: observedAbandonmentData,
      distributionType: distributionType, // Usamos el tipo de distribución seleccionado en la primera sección
    };

    // Añadir parámetros de la distribución teórica según el tipo seleccionado
    if (distributionType === 'poisson') {
      requestBody.lambda = lambda;
    } else { // Normal
      requestBody.mean = mean;
      requestBody.stdDev = stdDev;
    }

    try {
      const response = await fetch('/api/run_goodness_of_fit_test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al ejecutar la prueba.');
      }

      const results = await response.json();
      setTestResults(results);

    } catch (err) {
      console.error("Error al ejecutar la prueba:", err);
      setTestError(err.message);
    } finally {
      setTestLoading(false);
    }
  };


  useEffect(() => {
    generateChartData();
  }, [distributionType, lambda, mean, stdDev]);

  useEffect(() => {
    generateObservedChart();
  }, [observedAbandonmentData]);

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
        
        <div style={{ width: '70%', margin: '20px auto' }}>
          {observedChartData.datasets && observedChartData.datasets[0] && observedChartData.datasets[0].data.length > 0 && (
            <Bar data={observedChartData} options={observedChartOptions} />
          )}
        </div>

        {/* Sección de Pruebas de Bondad de Ajuste */}
        <div style={{ marginTop: '20px', borderTop: '1px solid #eee', paddingTop: '20px' }}>
            <h3>Pruebas de Bondad de Ajuste</h3>
            <p>Selecciona una prueba para determinar si tus datos de abandono se ajustan a la distribución teórica seleccionada en la sección superior.</p>
            <div>
                <label>
                    Tipo de Prueba:
                    <select value={testType} onChange={(e) => setTestType(e.target.value)}>
                        <option value="chi_square">Chi-cuadrado ($\chi^2$)</option>
                        <option value="kolmogorov_smirnov">Kolmogorov-Smirnov (K-S)</option>
                    </select>
                </label>
                <button 
                  onClick={runGoodnessOfFitTest} 
                  disabled={testLoading}
                  style={{ marginLeft: '15px', padding: '10px 20px', fontSize: '16px', backgroundColor: '#4CAF50', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}
                >
                  {testLoading ? 'Ejecutando...' : 'Ejecutar Prueba'}
                </button>
            </div>

            {testLoading && <p style={{ marginTop: '15px' }}>Calculando la prueba...</p>}
            {testError && <p style={{ color: 'red', marginTop: '15px' }}>Error en la prueba: {testError}</p>}

            {testResults && !testLoading && !testError && (
                <div style={{ marginTop: '20px', border: '1px solid #ddd', padding: '15px', borderRadius: '8px', backgroundColor: '#f9f9f9' }}>
                    <h4>Resultados de la Prueba ({testResults.testType === 'chi_square' ? 'Chi-cuadrado' : 'Kolmogorov-Smirnov'})</h4>
                    {/* CORRECCIÓN AQUÍ: Capitalizar correctamente en JS */}
                    <p><strong>Distribución Teórica Comparada:</strong> {testResults.distributionType.charAt(0).toUpperCase() + testResults.distributionType.slice(1)} ({testResults.distributionType === 'poisson' ? `λ=${lambda}` : `μ=${mean}, σ=${stdDev}`})</p>
                    <p><strong>Estadístico de Prueba:</strong> {testResults.statistic}</p>
                    <p><strong>P-valor:</strong> {testResults.pValue}</p>
                    {testResults.details.degrees_of_freedom !== undefined && (
                        <p><strong>Grados de Libertad:</strong> {testResults.details.degrees_of_freedom}</p>
                    )}
                    <p><strong>Conclusión:</strong> {testResults.conclusion}</p>
                    {testResults.details.grouped_observed_counts && (
                      <section className="test-results-container">
          <h2>Resultados de la Prueba ({testResults.testType === 'chi_square' ? 'Chi-cuadrado' : 'Kolmogorov-Smirnov'})</h2>
          <p>
            **Distribución Teórica Comparada:**{' '}
            {testResults.distributionType === 'poisson' && `Poisson (λ=${lambda})`}
            {testResults.distributionType === 'normal' && `Normal (μ=${mean}, σ=${stdDev})`}
          </p>
          {testResults.statistic !== null && (
            <p>
              **Estadístico de Prueba:** {testResults.statistic}
            </p>
          )}
          {testResults.pValue !== null && (
            <p>
              **P-valor:** {testResults.pValue}
            </p>
          )}

          {/* ESTA ES LA SECCIÓN NUEVA/MODIFICADA PARA LA TABLA */}
          {testResults.details && testResults.details.grouped_observed_counts && testResults.details.grouped_expected_counts && (
            <div className="frequency-table-container">
              <h3>Frecuencias Agrupadas para la Prueba Chi-cuadrado:</h3>
              <table>
                <thead>
                  <tr>
                    <th>Grupo/Categoría</th>
                    <th>Frecuencias Observadas</th>
                    <th>Frecuencias Esperadas</th>
                  </tr>
                </thead>
                <tbody>
                  {testResults.details.grouped_observed_counts.map((obs, index) => (
                    <tr key={index}>
                      <td>{index + 1}</td> {/* Si quieres, podrías hacer un rango aquí, pero para simplicidad, se usa el índice. */}
                      <td>{obs.toFixed(2)}</td>
                      <td>{testResults.details.grouped_expected_counts[index].toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {testResults.details.degrees_of_freedom !== undefined && (
                <p className="small-text">
                  Grados de Libertad (df): {testResults.details.degrees_of_freedom}
                </p>
              )}
              <p className="small-text">
                Nota: Las frecuencias esperadas menores a 5 se agrupan para la validez de la prueba Chi-cuadrado, siguiendo el criterio de Cochran.
              </p>
            </div>
          )}
          {/* FIN DE LA SECCIÓN MODIFICADA */}

          <p>
            **Conclusión:** {testResults.conclusion}
          </p>
        </section>
                    )}
                </div>
            )}
        </div>

        {/* Sección de Conclusiones y Recomendaciones */}
        <div style={{ marginTop: '40px', borderTop: '1px solid #eee', paddingTop: '20px' }}>
            <h2>Conclusiones y Recomendaciones</h2>
            {testResults ? (
                <div>
                    {testResults.conclusion.includes("NO se ajustan") ? (
                        <>
                            {/* CORRECCIÓN AQUÍ: Capitalizar correctamente en JS */}
                            <p><strong>Los datos observados de abandono NO se ajustan a la distribución {testResults.distributionType.charAt(0).toUpperCase() + testResults.distributionType.slice(1)} con los parámetros seleccionados.</strong> Esto sugiere que la forma en que los estudiantes abandonan no sigue este patrón estadístico específico.</p>
                            <h3>Posibles Razones y Recomendaciones:</h3>
                            <ul>
                                <li>**Exploración de otros factores:** Investiga otros factores que podrían influir en el abandono, como el rendimiento académico, situación socioeconómica, apoyo psicológico, calidad de la enseñanza, o eventos externos (pandemias, crisis económicas).</li>
                                <li>**Prueba con diferentes distribuciones:** Intenta ajustar los datos a otras distribuciones de probabilidad (ej. Binomial Negativa si hay "sobre-dispersión" en los conteos, o una Normal con diferentes parámetros) para ver si alguna se ajusta mejor.</li>
                                <li>**Análisis de Segmentos:** Divide a los estudiantes por cohortes (ej. por año de ingreso, por programa de estudio) y analiza el abandono para cada segmento. Los patrones podrían variar.</li>
                                <li>**Modelos Predictivos:** Considera el uso de modelos de Machine Learning (ej. regresión logística, árboles de decisión) que puedan identificar a los estudiantes en riesgo de abandono basándose en múltiples variables.</li>
                                <li>**Recopilación de Datos Adicionales:** Si es posible, recolecta datos más detallados sobre las razones del abandono directamente de los estudiantes (encuestas de salida, entrevistas).</li>
                            </ul>
                        </>
                    ) : (
                        <>
                            {/* CORRECCIÓN AQUÍ: Capitalizar correctamente en JS */}
                            <p><strong>Los datos observados de abandono PUEDEN ajustarse a la distribución {testResults.distributionType.charAt(0).toUpperCase() + testResults.distributionType.slice(1)} con los parámetros seleccionados.</strong> Esto implica que el patrón de abandono podría estar influenciado por un proceso aleatorio consistente con esta distribución. Por ejemplo, en Poisson, esto podría indicar que la tasa promedio de abandono ($\lambda$) es relativamente constante por semestre.</p>
                            <h3>Posibles Acciones y Recomendaciones:</h3>
                            <ul>
                                <li>**Validación del Modelo:** Aunque la prueba no rechazó la hipótesis nula, esto no prueba que los datos *definitivamente* sigan esa distribución. Es una buena indicación, pero siempre es útil validar con más datos o con otros métodos.</li>
                                <li>**Comprensión de los Parámetros:** Si se ajusta a Poisson, el $\lambda$ (media de eventos por semestre) es un indicador clave. Si se ajusta a Normal, la media y desviación estándar describen el pico y la dispersión del abandono. Usa estos parámetros para entender mejor el fenómeno.</li>
                                <li>**Identificación de Semestres Críticos:** Observa dónde se concentra la mayor probabilidad de abandono según la distribución teórica. Por ejemplo, con $\lambda=2$ en Poisson, los semestres 1 y 2 son críticos.</li>
                                <li>**Intervenciones Dirigidas:** Diseña programas de apoyo dirigidos a los semestres o períodos donde la distribución predice un mayor abandono. Esto podría incluir tutorías, apoyo financiero, asesoramiento académico o psicológico.</li>
                                <li>**Monitoreo Continuo:** Sigue monitoreando los datos de abandono para ver si el patrón se mantiene con el tiempo y si las intervenciones tienen un impacto.</li>
                            </ul>
                        </>
                    )}
                </div>
            ) : (
                <p>Ejecuta una prueba de bondad de ajuste para ver conclusiones y recomendaciones.</p>
            )}
        </div>
      </section>
    </div>
  );
}

export default App;