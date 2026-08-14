const radCliente = document.getElementById('cliente');
const radComerciante = document.getElementById('comerciante');
const boxCliente = document.getElementById('campos-cliente');
const boxComerciante = document.getElementById('campos-comerciante');

radCliente.addEventListener('change', () => {
    if (radCliente.checked) {
        boxCliente.style.display = 'block';
        boxComerciante.style.display = 'none';
    }
});

radComerciante.addEventListener('change', () => {
    if (radComerciante.checked) {
        boxCliente.style.display = 'none';
        boxComerciante.style.display = 'block';
    }
});