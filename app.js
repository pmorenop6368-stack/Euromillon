let baseSorteos = [];

// Carga automática del sorteos.json local si está subido al servidor/GitHub
window.addEventListener('DOMContentLoaded', () => {
  cargarJSONPredeterminado();
});

// Función para cargar el archivo JSON por defecto mediante fetch
function cargarJSONPredeterminado() {
  fetch('sorteos.json')
    .then(response => {
      if (!response.ok) throw new Error('No se encontró el archivo sorteos.json');
      return response.json();
    })
    .then(data => {
      baseSorteos = data;
      analizarDatos(baseSorteos);
      document.getElementById('aiStatus').innerText = 'IA lista para entrenar con el archivo por defecto.';
    })
    .catch(err => {
      console.log('Esperando carga manual de archivo...', err);
    });
}

// Lector de archivos subidos (.xlsx o .json)
document.getElementById('fileInput').addEventListener('change', function(e) {
  const file = e.target.files[0];
  if (!file) return;

  const fileName = file.name.toLowerCase();

  if (fileName.endsWith('.json')) {
    const reader = new FileReader();
    reader.onload = function(evt) {
      baseSorteos = JSON.parse(evt.target.result);
      analizarDatos(baseSorteos);
    };
    reader.readAsText(file);
  } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
    const reader = new FileReader();
    reader.onload = function(evt) {
      const data = new Uint8Array(evt.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const rawData = XLSX.utils.sheet_to_json(sheet);

      // Conversión flexible del Excel a nuestro formato JSON
      baseSorteos = rawData.map(row => {
        return {
          fecha: row.Fecha || row.FECHA || new Date().toISOString().split('T')[0],
          numeros: [
            Number(row.N1 || row.Numero1 || row.n1),
            Number(row.N2 || row.Numero2 || row.n2),
            Number(row.N3 || row.Numero3 || row.n3),
            Number(row.N4 || row.Numero4 || row.n4),
            Number(row.N5 || row.Numero5 || row.n5)
          ].filter(Boolean),
          estrellas: [
            Number(row.E1 || row.Estrella1 || row.e1),
            Number(row.E2 || row.Estrella2 || row.e2)
          ].filter(Boolean)
        };
      });

      analizarDatos(baseSorteos);
    };
    reader.readAsArrayBuffer(file);
  }
});

// Agregar sorteo de forma manual
function agregarSorteo() {
  const fecha = document.getElementById('newFecha').value;
  const numInput = document.getElementById('newNumeros').value;
  const estInput = document.getElementById('newEstrellas').value;

  if (!fecha || !numInput || !estInput) {
    alert('Completa la fecha, los 5 números y las 2 estrellas.');
    return;
  }

  const numeros = numInput.split(',').map(n => parseInt(n.trim())).filter(n => !isNaN(n));
  const estrellas = estInput.split(',').map(e => parseInt(e.trim())).filter(e => !isNaN(e));

  if (numeros.length !== 5 || estrellas.length !== 2) {
    alert('Asegúrate de ingresar 5 números y 2 estrellas válidas.');
    return;
  }

  const nuevoSorteo = { fecha, numeros, estrellas };
  baseSorteos.unshift(nuevoSorteo);

  analizarDatos(baseSorteos);

  document.getElementById('newNumeros').value = '';
  document.getElementById('newEstrellas').value = '';
  alert('Sorteo agregado con éxito.');
}

// Descargar el JSON actualizado
function exportarJSON() {
  if (baseSorteos.length === 0) {
    alert('No hay datos para exportar.');
    return;
  }
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(baseSorteos, null, 2));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute("href", dataStr);
  downloadAnchor.setAttribute("download", "sorteos.json");
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}

// Algoritmo de Análisis Frecuencial + Co-ocurrencia
function analizarDatos(sorteos) {
  document.getElementById('totalSorteos').innerText = sorteos.length;

  const freqNum = {};
  const freqEstrellas = {};
  const coOcurrenciaNum = {};

  for (let i = 1; i <= 50; i++) { freqNum[i] = 0; coOcurrenciaNum[i] = 0; }
  for (let i = 1; i <= 12; i++) { freqEstrellas[i] = 0; }

  sorteos.forEach(sorteo => {
    sorteo.numeros.forEach(num => { if (freqNum[num] !== undefined) freqNum[num]++; });
    sorteo.estrellas.forEach(est => { if (freqEstrellas[est] !== undefined) freqEstrellas[est]++; });
  });

  const ordenados = Object.keys(freqNum).sort((a, b) => freqNum[b] - freqNum[a]);
  const calientes = ordenados.slice(0, 10).map(Number);
  const frios = ordenados.slice(-10).map(Number);

  // Análisis de co-ocurrencia con números calientes
  sorteos.forEach(sorteo => {
    const tieneCaliente = sorteo.numeros.some(n => calientes.includes(n));
    if (tieneCaliente) {
      sorteo.numeros.forEach(num => {
        if (!calientes.includes(num)) {
          coOcurrenciaNum[num]++;
        }
      });
    }
  });

  const templados = Object.keys(coOcurrenciaNum)
    .filter(n => !calientes.includes(Number(n)))
    .sort((a, b) => coOcurrenciaNum[b] - coOcurrenciaNum[a])
    .slice(0, 10)
    .map(Number);

  const estrellasOrdenadas = Object.keys(freqEstrellas).sort((a, b) => freqEstrellas[b] - freqEstrellas[a]);
  const estCalientes = estrellasOrdenadas.slice(0, 3);
  const estFrias = estrellasOrdenadas.slice(-3);
  const estTempladas = estrellasOrdenadas.slice(3, -3);

  renderizar('hotNumbers', calientes, 'hot', freqNum);
  renderizar('warmNumbers', templados, 'warm', coOcurrenciaNum);
  renderizar('coldNumbers', frios, 'cold', freqNum);

  document.getElementById('hotStars').innerText = estCalientes.join(', ');
  document.getElementById('warmStars').innerText = estTempladas.join(', ');
  document.getElementById('coldStars').innerText = estFrias.join(', ');
}

function renderizar(elementId, numeros, clase, diccionario) {
  const contenedor = document.getElementById(elementId);
  contenedor.innerHTML = '';
  numeros.forEach(num => {
    const span = document.createElement('span');
    span.className = `badge ${clase}`;
    span.innerText = `N° ${num} (${diccionario[num]})`;
    contenedor.appendChild(span);
  });
}

// Módulo de Inteligencia Artificial (Red Neuronal con TensorFlow.js)
async function entrenarIA() {
  if (baseSorteos.length < 5) {
    alert('Necesitas cargar al menos 5 sorteos para entrenar la IA.');
    return;
  }

  const statusEl = document.getElementById('aiStatus');
  const outputEl = document.getElementById('aiOutput');
  statusEl.innerText = 'Entrenando Red Neuronal en el navegador...';

  // Preparar matriz de datos (One-Hot Encoding de 50 números)
  const inputs = [];
  const outputs = [];

  for (let i = 0; i < baseSorteos.length - 1; i++) {
    const inputVec = new Array(50).fill(0);
    const outputVec = new Array(50).fill(0);

    baseSorteos[i + 1].numeros.forEach(n => inputVec[n - 1] = 1);
    baseSorteos[i].numeros.forEach(n => outputVec[n - 1] = 1);

    inputs.push(inputVec);
    outputs.push(outputVec);
  }

  const xs = tf.tensor2d(inputs);
  const ys = tf.tensor2d(outputs);

  // Crear modelo de Red Neuronal Básica
  const model = tf.sequential();
  model.add(tf.layers.dense({ units: 64, activation: 'relu', inputShape: [50] }));
  model.add(tf.layers.dense({ units: 50, activation: 'sigmoid' }));

  model.compile({ optimizer: 'adam', loss: 'binaryCrossentropy' });

  // Entrenar el modelo durante 30 épocas
  await model.fit(xs, ys, { epochs: 30 });

  // Predecir probabilidades para el próximo sorteo tomando el último sorteo
  const ultimoSorteoVec = new Array(50).fill(0);
  baseSorteos[0].numeros.forEach(n => ultimoSorteoVec[n - 1] = 1);

  const prediccionTensor = model.predict(tf.tensor2d([ultimoSorteoVec]));
  const probabilidades = await prediccionTensor.data();

  // Mapear probabilidades con los números correspondientes
  const resultadosIA = [];
  probabilidades.forEach((prob, index) => {
    resultadosIA.push({ numero: index + 1, probabilidad: (prob * 100).toFixed(2) });
  });

  resultadosIA.sort((a, b) => b.probabilidad - a.probabilidad);

  const recomendadosIA = resultadosIA.slice(0, 5).map(r => `${r.numero} (${r.probabilidad}%)`);

  statusEl.innerText = '¡Entrenamiento e Inferencia completados!';
  outputEl.innerHTML = `
    <h4>🎯 Top 5 Números Sugeridos por la Red Neuronal:</h4>
    <p><strong>${recomendadosIA.join(' — ')}</strong></p>
  `;

  // Liberar memoria de tensores
  xs.dispose();
  ys.dispose();
  prediccionTensor.dispose();
}
