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
  // AÑADE ESTA LÍNEA para gestionar el tipo de gráfico como estado
  const [currentChartComponent, setCurrentChartComponent] = useState(Bar);


  // Función para calcular la PMF de Poisson (probabilidad puntual)
  const calculatePoissonPMF = (k, lambdaVal) => {
    if (k < 0 || !Number.isInteger(k)) return 0;
    return (Math.exp(-lambdaVal) * Math.pow(lambdaVal, k)) / factorial(k);
  };

  // Función para calcular la PDF de la Normal (densidad de probabilidad)
  const calculateNormalPDF = (x, meanVal, stdDevVal) => {
    const exponent = -Math.pow(x - meanVal, 2) / (2 * Math.pow(stdDevVal, 2));
    const factor = 1 / (stdDevVal * Math.sqrt(2 * Math.PI));
    return factor * Math.exp(exponent);
  };

  // Función auxiliar para calcular el factorial
  const factorial = (n) => {
    if (n === 0 || n === 1) return 1;
    let result = 1;
    for (let i = 2; i <= n; i++) {
      result *= i;
    }
    return result;
  };

  const generateChartData = () => {
    let labels = [];
    let data = [];
    let titleText = '';
    // MODIFICA ESTA LÍNEA para actualizar el estado del componente de gráfico
    setCurrentChartComponent(distributionType === 'poisson' ? Bar : Line);

    if (distributionType === 'poisson') {
      titleText = `Distribución de Poisson (λ = ${lambda})`;
      // Generar k desde 0 hasta un valor razonable (ej. lambda * 3 o 15)
      const maxK = Math.max(15, Math.ceil(lambda * 3));
      for (let k = 0; k <= maxK; k++) {
        labels.push(k.toString());
        data.push(calculatePoissonPMF(k, lambda));
      }
    } else { // Normal
      titleText = `Distribución Normal (μ = ${mean}, σ = ${stdDev})`;
      // Generar puntos para la curva normal (ej. +/- 4 desviaciones estándar)
      const minX = mean - 4 * stdDev;
      const maxX = mean + 4 * stdDev;
      const step = (maxX - minX) / 100; // 100 puntos para una curva suave

      for (let i = 0; i <= 100; i++) {
        const x = minX + i * step;
        labels.push(x.toFixed(2));
        data.push(calculateNormalPDF(x, mean, stdDev));
      }
    }

    setChartData({
      labels: labels,
      datasets: [
        {
          label: 'Probabilidad',
          data: data,
          backgroundColor: distributionType === 'poisson' ? 'rgba(75, 192, 192, 0.6)' : 'rgba(153, 102, 255, 0.6)',
          borderColor: distributionType === 'poisson' ? 'rgba(75, 192, 192, 1)' : 'rgba(153, 102, 255, 1)',
          borderWidth: 1,
          pointRadius: distributionType === 'poisson' ? 5 : 0, // Puntos solo para Poisson
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
        duration: 0 // Desactiva la animación para actualizaciones más rápidas
      }
    });
  };

  // Generar la gráfica al cargar el componente y cuando cambian los parámetros
  useEffect(() => {
    generateChartData();
  }, [distributionType, lambda, mean, stdDev]); // Dependencias del useEffect

  // Renderizado del componente
  const ChartComponent = currentChartComponent; // Asigna el componente de gráfico a una variable
  
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
        
        <div style={{ width: '70%', margin: '20px auto' }}>
          {/* Usa la variable de estado 'currentChartComponent' */}
          {chartData.datasets && ChartComponent && (
            <ChartComponent data={chartData} options={chartOptions} />
          )}
        </div>
      </section>

      {/* Aquí irá la sección de análisis de datos reales en fases futuras */}
      <section style={{ marginTop: '40px' }}>
        <h2>Análisis de Datos de Abandono Reales (Próximamente)</h2>
        <p>Esta sección permitirá ingresar datos de abandono y realizar pruebas de bondad de ajuste.</p>
      </section>
    </div>
  );
}

export default App;