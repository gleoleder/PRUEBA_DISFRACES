// ========================================
// DISFRACES FANTASÍA - SISTEMA COMPLETO
// ========================================

const APPS_SCRIPT_URL = typeof CONFIG !== 'undefined' ? CONFIG.APPS_SCRIPT_URL : '';

let sistemaListo = false;
let ultimoRegistro = null;
let registroSeleccionado = null;
let datosBuscarCliente = [];
let renderBuscarCliente = null;
let datosCargados = false;
let syncInterval = null;

// ========================================
// SEGURIDAD: ESCAPE HTML (previene XSS)
// ========================================

function esc(text) {
    if (text === null || text === undefined) return '';
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return String(text).replace(/[&<>"']/g, c => map[c]);
}

// ========================================
// DOM LOADED (INICIO DEL SISTEMA)
// ========================================

document.addEventListener('DOMContentLoaded', () => {
    verificarConexion();
    configurarTabs();
    configurarFechas();
    configurarAutollenadoCI();
    configurarFormularioRegistro();
    configurarBotonesPago();
    configurarBuscarCliente();
    configurarModalDevolucion();
    configurarEventosRecibo();
    configurarTeclasGlobales();

    cargarDatosAutomaticamente();
    iniciarSincronizacionMultiusuario();

    window.addEventListener('beforeunload', () => {
        if (syncInterval) clearInterval(syncInterval);
    });
});

// ========================================
// VALIDACIÓN DE FORMULARIO
// ========================================

function validarFormulario(datos) {
    if (!datos.cedula || datos.cedula.length < 5) {
        mostrarToast('Ingresá una cédula válida', 'error');
        document.getElementById('cedula').focus();
        return false;
    }
    if (!datos.nombre || datos.nombre.length < 2) {
        mostrarToast('El nombre es obligatorio', 'error');
        document.getElementById('nombre').focus();
        return false;
    }
    if (!datos.celular || datos.celular.replace(/\D/g, '').length < 7) {
        mostrarToast('El celular debe tener al menos 7 dígitos', 'error');
        document.getElementById('celular').focus();
        return false;
    }
    if (!datos.disfraz || datos.disfraz.length < 2) {
        mostrarToast('Ingresá el nombre del disfraz', 'error');
        document.getElementById('disfraz').focus();
        return false;
    }
    const precio = parseFloat(datos.precio);
    if (isNaN(precio) || precio < 0) {
        mostrarToast('El precio debe ser un número válido', 'error');
        document.getElementById('precio').focus();
        return false;
    }
    if (!datos.fechaAlq) {
        mostrarToast('Seleccioná la fecha de alquiler', 'error');
        return false;
    }
    if (!datos.fechaDev) {
        mostrarToast('Seleccioná la fecha de devolución', 'error');
        return false;
    }
    if (datos.fechaDev < datos.fechaAlq) {
        mostrarToast('La fecha de devolución no puede ser anterior al alquiler', 'error');
        return false;
    }
    if (!datos.condiciones) {
        mostrarToast('Seleccioná el estado del disfraz', 'error');
        document.getElementById('condiciones').focus();
        return false;
    }
    return true;
}

// ========================================
// TOAST (reemplaza los alert())
// ========================================

function mostrarToast(mensaje, tipo = 'exito', duracion = 3500) {
    let toast = document.getElementById('toast-global');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'toast-global';
        document.body.appendChild(toast);
    }
    toast.textContent = mensaje;
    toast.className = 'toast toast-' + tipo + ' toast-visible';
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => {
        toast.classList.remove('toast-visible');
    }, duracion);
}

// ========================================
// CARGA AUTOMÁTICA Y SINCRONIZACIÓN
// ========================================

async function cargarDatosAutomaticamente() {
    if (!APPS_SCRIPT_URL || APPS_SCRIPT_URL.includes('PEGAR_AQUI')) return;

    const resBusqueda = document.getElementById('resultados-buscar-cliente');
    if (resBusqueda && !datosCargados) {
        resBusqueda.innerHTML = '<div class="loading">Sincronizando base de datos...</div>';
    }

    try {
        const r = await fetch(APPS_SCRIPT_URL + '?accion=listar');
        if (!r.ok) throw new Error('HTTP ' + r.status);
        const d = await r.json();

        if (d.exito && d.registros) {
            datosBuscarCliente = d.registros;
            datosCargados = true;
            calcularStats(d.registros);
            if (renderBuscarCliente) renderBuscarCliente(datosBuscarCliente);
            actualizarVistasSecundarias();
        }
    } catch (e) {
        console.error('Error carga inicial:', e);
    }
}

function iniciarSincronizacionMultiusuario() {
    if (syncInterval) clearInterval(syncInterval);

    syncInterval = setInterval(async () => {
        if (!datosCargados || !APPS_SCRIPT_URL || APPS_SCRIPT_URL.includes('PEGAR_AQUI')) return;

        try {
            const r = await fetch(APPS_SCRIPT_URL + '?accion=listar');
            if (!r.ok) return;
            const d = await r.json();

            if (d.exito && d.registros) {
                const dataNueva = JSON.stringify(d.registros);
                const dataActual = JSON.stringify(datosBuscarCliente);

                if (dataNueva !== dataActual) {
                    datosBuscarCliente = d.registros;
                    calcularStats(d.registros);
                    actualizarVistasSecundarias();

                    const tabBuscar = document.getElementById('tab-buscar');
                    const inputBusqueda = document.getElementById('buscar-cliente-input');
                    if (tabBuscar && tabBuscar.classList.contains('active')) {
                        if (!inputBusqueda || !inputBusqueda.value.trim()) {
                            if (renderBuscarCliente) renderBuscarCliente(datosBuscarCliente);
                        }
                    }
                }
            }
        } catch (e) {
            // silencioso — no interrumpe al usuario si el internet parpadea
        }
    }, 15000);
}

function actualizarVistasSecundarias() {
    const tabHistorial = document.getElementById('tab-historial');
    if (tabHistorial && tabHistorial.classList.contains('active')) mostrarHistorial(datosBuscarCliente);
}

// ========================================
// AUTOLLENADO POR CI
// ========================================

function configurarAutollenadoCI() {
    let timeoutCedula = null;
    const inputCedula = document.getElementById('cedula');

    if (inputCedula) {
        inputCedula.addEventListener('input', function () {
            const v = this.value.trim();
            const loader = document.getElementById('cedula-loader');
            if (loader) loader.style.display = v.length >= 5 ? 'inline' : 'none';

            clearTimeout(timeoutCedula);

            if (v.length >= 5) {
                timeoutCedula = setTimeout(() => {
                    if (datosCargados && datosBuscarCliente.length > 0) {
                        const encontrados = datosBuscarCliente.filter(r =>
                            (r.Cedula || '').toString().toUpperCase() === v.toUpperCase()
                        );
                        procesarDatosAutollenado(encontrados);
                    }
                    if (loader) loader.style.display = 'none';
                }, 600);
            } else {
                ocultarAlertas();
                if (loader) loader.style.display = 'none';
            }
        });
    }
}

function procesarDatosAutollenado(registros) {
    if (!registros || registros.length === 0) {
        ocultarAlertas();
        return;
    }

    registros.sort((a, b) => b.fila - a.fila);
    const ultimo = registros[0];
    const pendientes = registros.filter(r => r.Estado === 'Alquilado');

    const inputNombre = document.getElementById('nombre');
    const inputCelular = document.getElementById('celular');

    if (inputNombre && !inputNombre.value) inputNombre.value = (ultimo.Nombre || '').toUpperCase();
    if (inputCelular && !inputCelular.value) inputCelular.value = ultimo.Celular || '';

    const alertaHab = document.getElementById('alerta-habitual');
    const alertaHabTexto = document.getElementById('alerta-habitual-texto');
    if (alertaHab && alertaHabTexto) {
        alertaHabTexto.textContent = '';
        const strong = document.createElement('strong');
        strong.textContent = 'Cliente Habitual: ';
        alertaHabTexto.appendChild(strong);
        alertaHabTexto.appendChild(document.createTextNode(registros.length + ' alquiler(es) previos.'));
        alertaHab.style.display = 'flex';
    }

    const alertaDeu = document.getElementById('alerta-deudas');
    if (alertaDeu) {
        if (pendientes.length > 0) {
            alertaDeu.textContent = '';
            const strong = document.createElement('strong');
            strong.textContent = '⚠️ Tiene ' + pendientes.length + ' disfraz(es) sin devolver:';
            alertaDeu.appendChild(strong);
            const ul = document.createElement('ul');
            ul.className = 'deuda-lista';
            pendientes.forEach(p => {
                const li = document.createElement('li');
                const vencido = p.FechaDevolucion && fechaParaComparar(p.FechaDevolucion) < fechaBoliviaHoy();
                li.innerHTML =
                    '<span class="deuda-disfraz">🎭 ' + esc(p.Disfraz || '-') + '</span>' +
                    '<span class="deuda-dato">📅 Llevó: ' + formatearFecha(p.FechaAlquiler) + '</span>' +
                    '<span class="deuda-dato ' + (vencido ? 'deuda-vencida' : '') + '">🔔 Devolver: ' + formatearFecha(p.FechaDevolucion) + (vencido ? ' — VENCIDO' : '') + '</span>';
                ul.appendChild(li);
            });
            alertaDeu.appendChild(ul);
            alertaDeu.style.display = 'flex';
        } else {
            alertaDeu.style.display = 'none';
        }
    }
}

function ocultarAlertas() {
    const aHab = document.getElementById('alerta-habitual');
    const aDeu = document.getElementById('alerta-deudas');
    if (aHab) aHab.style.display = 'none';
    if (aDeu) aDeu.style.display = 'none';
}

// ========================================
// REGISTRO DE NUEVO ALQUILER
// ========================================

// Datos pendientes de guardar (se llenan al hacer submit, se envían al confirmar)
let datosPendientes = null;

// ========================================
// MODAL ADVERTENCIA DISFRACES PENDIENTES
// ========================================

function mostrarModalAdvertencia(pendientes, onContinuar) {
    let modal = document.getElementById('modal-advertencia');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'modal-advertencia';
        modal.className = 'modal-advertencia-overlay';
        document.body.appendChild(modal);
    }

    const hoy = fechaBoliviaHoy();

    let filasHTML = '';
    pendientes.forEach(p => {
        const vencido = p.FechaDevolucion && fechaParaComparar(p.FechaDevolucion) < hoy;
        filasHTML +=
            '<div class="adv-fila">' +
                '<div class="adv-disfraz">🎭 ' + esc(p.Disfraz || '-') + '</div>' +
                '<div class="adv-fechas">' +
                    '<span>📅 Llevó: <strong>' + formatearFecha(p.FechaAlquiler) + '</strong></span>' +
                    '<span class="' + (vencido ? 'adv-vencido' : 'adv-ok') + '">🔔 Devolver: <strong>' + formatearFecha(p.FechaDevolucion) + '</strong>' + (vencido ? ' — VENCIDO' : '') + '</span>' +
                '</div>' +
            '</div>';
    });

    modal.innerHTML =
        '<div class="modal-advertencia-box">' +
            '<div class="adv-header">' +
                '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>' +
                '<span>Este cliente tiene ' + pendientes.length + ' disfraz(es) SIN devolver</span>' +
            '</div>' +
            '<div class="adv-lista">' + filasHTML + '</div>' +
            '<p class="adv-pregunta">¿Querés registrar un nuevo alquiler de todas formas?</p>' +
            '<div class="adv-acciones">' +
                '<button id="adv-btn-cancelar" class="adv-btn-no">No, volver</button>' +
                '<button id="adv-btn-continuar" class="adv-btn-si">Sí, continuar</button>' +
            '</div>' +
        '</div>';

    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';

    modal.querySelector('#adv-btn-cancelar').addEventListener('click', () => {
        modal.style.display = 'none';
        document.body.style.overflow = '';
        datosPendientes = null;
    });

    modal.querySelector('#adv-btn-continuar').addEventListener('click', () => {
        modal.style.display = 'none';
        document.body.style.overflow = '';
        onContinuar();
    });

    // ESC cierra
    const cerrarEsc = e => {
        if (e.key === 'Escape') {
            modal.style.display = 'none';
            document.body.style.overflow = '';
            datosPendientes = null;
            document.removeEventListener('keydown', cerrarEsc);
        }
    };
    document.addEventListener('keydown', cerrarEsc);
}

function nowBolivia() {
    // Siempre America/La_Paz — nunca depender del reloj del servidor
    const f = new Date();
    const p = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'America/La_Paz',
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        hour12: false
    }).formatToParts(f);
    const get = t => p.find(x => x.type === t)?.value || '00';
    return get('day') + '/' + get('month') + '/' + get('year') + ' ' + get('hour') + ':' + get('minute') + ':' + get('second');
}

function leerDatosFormulario() {
    const fechaHoraBolivia = nowBolivia();

    const pagoTipo = document.getElementById('pago-tipo')?.value || 'Efectivo';
    const garantiaPagoTipo = document.getElementById('garantia-pago-tipo')?.value || 'Efectivo';

    return {
        nombre: document.getElementById('nombre').value.trim().toUpperCase(),
        cedula: document.getElementById('cedula').value.trim().toUpperCase(),
        celular: document.getElementById('celular').value.trim(),
        disfraz: document.getElementById('disfraz').value.trim().toUpperCase(),
        precio: document.getElementById('precio').value || '0',
        pagoTipo,
        precioEfectivo: pagoTipo === 'Mixto' ? (document.getElementById('precio-efectivo')?.value || '0') : '',
        precioQr: pagoTipo === 'Mixto' ? (document.getElementById('precio-qr')?.value || '0') : '',
        fechaAlq: document.getElementById('fecha-alquiler').value,
        fechaDev: document.getElementById('fecha-devolucion').value,
        condiciones: document.getElementById('condiciones').value,
        garantiaDin: document.getElementById('garantia-dinero').value || '0',
        garantiaPagoTipo,
        garantiaEfectivo: garantiaPagoTipo === 'Mixto' ? (document.getElementById('garantia-efectivo')?.value || '0') : '',
        garantiaQr: garantiaPagoTipo === 'Mixto' ? (document.getElementById('garantia-qr')?.value || '0') : '',
        garantiaObj: document.getElementById('garantia-objeto').value.trim().toUpperCase(),
        obs: document.getElementById('observaciones').value.trim().toUpperCase(),
        fechaRegistro: fechaHoraBolivia
    };
}

// ========================================
// BOTONES MÉTODO DE PAGO
// ========================================

function configurarBotonesPago() {
    // Configurar un grupo: ids del grupo de botones, del hidden input, y del div mixto
    function setupGrupo(grupoBtnsId, hiddenInputId, mixtoRowId) {
        const grupo = document.getElementById(grupoBtnsId);
        if (!grupo) return;
        grupo.querySelectorAll('.pago-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                grupo.querySelectorAll('.pago-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const tipo = btn.dataset.pago;
                const hidden = document.getElementById(hiddenInputId);
                if (hidden) hidden.value = tipo;
                const mixtoRow = document.getElementById(mixtoRowId);
                if (mixtoRow) mixtoRow.style.display = tipo === 'Mixto' ? 'grid' : 'none';
            });
        });
    }
    setupGrupo('pago-tipo-grupo', 'pago-tipo', 'pago-mixto-alquiler');
    setupGrupo('garantia-pago-tipo-grupo', 'garantia-pago-tipo', 'pago-mixto-garantia');
}

function resetBotonesPago() {
    function resetGrupo(grupoBtnsId, hiddenInputId, mixtoRowId) {
        const grupo = document.getElementById(grupoBtnsId);
        if (!grupo) return;
        grupo.querySelectorAll('.pago-btn').forEach(b => b.classList.remove('active'));
        const first = grupo.querySelector('.pago-btn[data-pago="Efectivo"]');
        if (first) first.classList.add('active');
        const hidden = document.getElementById(hiddenInputId);
        if (hidden) hidden.value = 'Efectivo';
        const mixtoRow = document.getElementById(mixtoRowId);
        if (mixtoRow) mixtoRow.style.display = 'none';
    }
    resetGrupo('pago-tipo-grupo', 'pago-tipo', 'pago-mixto-alquiler');
    resetGrupo('garantia-pago-tipo-grupo', 'garantia-pago-tipo', 'pago-mixto-garantia');
}

function dispararRegistro() {
    const datos = leerDatosFormulario();
    if (!validarFormulario(datos)) return;

    datosPendientes = datos;

    const cedula = datos.cedula;
    const pendientes = datosBuscarCliente.filter(r =>
        (r.Cedula || '').toString().toUpperCase() === cedula && r.Estado === 'Alquilado'
    );

    if (pendientes.length > 0) {
        mostrarModalAdvertencia(pendientes, () => mostrarRecibo(datosPendientes, true, true));
    } else {
        mostrarRecibo(datos, true, true);
    }
}

function dispararLimpiar() {
    const formRegistro = document.getElementById('form-registro');
    if (formRegistro) formRegistro.reset();
    const btnImprimir = document.getElementById('btn-imprimir-recibo');
    const btnPrevia = document.getElementById('btn-vista-previa');
    if (btnImprimir) btnImprimir.style.display = 'none';
    if (btnPrevia) btnPrevia.style.display = 'inline-flex';
    resetBotonesPago();
    ocultarAlertas();
    datosPendientes = null;
    setTimeout(configurarFechas, 10);
}

function configurarHold(btnEl, accion, duracionMs = 2000) {
    let timer = null;
    let rafId = null;
    let startTime = null;
    const fill = btnEl.querySelector('.btn-hold-fill');

    function animar() {
        if (!startTime) return;
        const elapsed = Date.now() - startTime;
        const pct = Math.min((elapsed / duracionMs) * 100, 100);
        if (fill) fill.style.width = pct + '%';
        if (pct < 100) rafId = requestAnimationFrame(animar);
    }

    function resetFill() {
        cancelAnimationFrame(rafId);
        rafId = null;
        startTime = null;
        if (fill) fill.style.width = '0%';
    }

    function iniciar(e) {
        if (btnEl.disabled) return;
        e.preventDefault();
        startTime = Date.now();
        rafId = requestAnimationFrame(animar);

        timer = setTimeout(() => {
            resetFill();
            accion();
        }, duracionMs);
    }

    function cancelar() {
        clearTimeout(timer);
        timer = null;
        resetFill();
    }

    btnEl.addEventListener('mousedown', iniciar);
    btnEl.addEventListener('touchstart', iniciar, { passive: false });
    btnEl.addEventListener('mouseup', cancelar);
    btnEl.addEventListener('mouseleave', cancelar);
    btnEl.addEventListener('touchend', cancelar);
    btnEl.addEventListener('touchcancel', cancelar);
}

function configurarFormularioRegistro() {
    const formRegistro = document.getElementById('form-registro');
    if (!formRegistro) return;

    // Evitar submit nativo (el botón ya no es type=submit)
    formRegistro.addEventListener('submit', e => e.preventDefault());

    const btnRegistrar = document.getElementById('btn-registrar');
    if (btnRegistrar) configurarHold(btnRegistrar, dispararRegistro, 800);

    const btnLimpiar = document.getElementById('btn-limpiar');
    if (btnLimpiar) configurarHold(btnLimpiar, dispararLimpiar, 800);
}

// ========================================
// BUSCADOR ORDENADO DESPLEGABLE
// ========================================

// ========================================
// FECHAS BOLIVIA — sistema unificado
// Formatos que pueden llegar del sheet:
//   dd/MM/yyyy HH:mm   ← Apps Script nuevo
//   yyyy-MM-dd         ← input date HTML
//   yyyy-MM-ddTHH:mm   ← ISO
// ========================================

// Convierte cualquier formato a { dd, mm, yyyy, hh, min } o null
function _parsearFecha(cadena) {
    if (!cadena) return null;
    const s = String(cadena).trim();
    if (!s || s === '-') return null;

    // dd/MM/yyyy HH:mm:ss  o  dd/MM/yyyy HH:mm  o  dd/MM/yyyy
    const m1 = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::\d{2})?)?/);
    if (m1) return { dd: m1[1].padStart(2,'0'), mm: m1[2].padStart(2,'0'), yyyy: m1[3], hh: m1[4] ? m1[4].padStart(2,'0') : null, min: m1[5] || null };

    // yyyy-MM-dd  o  yyyy-MM-ddTHH:mm
    const m2 = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2}))?/);
    if (m2) return { dd: m2[3], mm: m2[2], yyyy: m2[1], hh: m2[4] || null, min: m2[5] || null };

    // Mon May 25 2026 ... (String(Date) de JS o Apps Script)
    const m3 = s.match(/\b(\d{4})\b/);
    if (m3) {
        try {
            const d = new Date(s);
            if (!isNaN(d)) {
                const parts = new Intl.DateTimeFormat('en-GB', {
                    timeZone: 'America/La_Paz',
                    year: 'numeric', month: '2-digit', day: '2-digit',
                    hour: '2-digit', minute: '2-digit', hour12: false
                }).formatToParts(d);
                const get = t => parts.find(x => x.type === t)?.value || '00';
                return { dd: get('day'), mm: get('month'), yyyy: get('year'), hh: get('hour'), min: get('minute') };
            }
        } catch(e) {}
    }

    return null;
}

// Muestra solo fecha: 24/05/2026
function formatearFecha(cadena) {
    const p = _parsearFecha(cadena);
    if (!p) return '-';
    return p.dd + '/' + p.mm + '/' + p.yyyy;
}

// Muestra fecha + hora: 24/05/2026 14:30
function formatearFechaHora(cadena) {
    const p = _parsearFecha(cadena);
    if (!p) return '-';
    const fecha = p.dd + '/' + p.mm + '/' + p.yyyy;
    return p.hh ? fecha + ' ' + p.hh + ':' + p.min : fecha;
}

// Extrae solo la parte yyyy-MM-dd para comparar con fechaBoliviaHoy()
function fechaParaComparar(cadena) {
    const p = _parsearFecha(cadena);
    if (!p) return '';
    return p.yyyy + '-' + p.mm + '-' + p.dd;
}

window.filtrarCliente = function (valor) {
    const btnClear = document.getElementById('buscar-cliente-clear');
    if (btnClear) btnClear.style.display = valor ? 'block' : 'none';
    if (!renderBuscarCliente) return;

    if (!valor || !valor.trim()) {
        renderBuscarCliente(datosBuscarCliente);
        return;
    }

    const q = valor.trim().toLowerCase();
    const filtrados = datosBuscarCliente.filter(r =>
        (r.Nombre || '').toString().toLowerCase().includes(q) ||
        (r.Cedula || '').toString().toLowerCase().includes(q) ||
        (r.Celular || '').toString().toLowerCase().includes(q) ||
        (r.Disfraz || '').toString().toLowerCase().includes(q)
    );
    renderBuscarCliente(filtrados);
};

function configurarBuscarCliente() {
    const resultado = document.getElementById('resultados-buscar-cliente');
    const contador = document.getElementById('busqueda-contador');

    renderBuscarCliente = function (registros) {
        if (!registros || !registros.length) {
            if (resultado) resultado.innerHTML = '<p class="placeholder-text">Sin coincidencias</p>';
            if (contador) contador.textContent = '0 resultados';
            return;
        }

        const registrosOrdenados = [...registros].sort((a, b) => b.fila - a.fila);

        const clientes = {};
        registrosOrdenados.forEach(r => {
            const ci = r.Cedula || 'S-CI';
            if (!clientes[ci]) {
                clientes[ci] = { n: r.Nombre, ci: ci, cel: r.Celular, alqs: [], maxFila: r.fila };
            }
            clientes[ci].alqs.push(r);
        });

        const clientesArray = Object.values(clientes).sort((a, b) => b.maxFila - a.maxFila);

        if (contador) contador.textContent = clientesArray.length + ' cliente(s)';

        if (resultado) {
            resultado.innerHTML = '';
            clientesArray.forEach((c, idx) => {
                const tienePend = c.alqs.some(a => a.Estado === 'Alquilado');
                const idDesplegable = 'desplegable-cliente-' + idx;
                const card = document.createElement('div');
                card.className = 'cliente-card';

                // Número whatsapp seguro
                const celLimpio = String(c.cel || '').replace(/\s+/g, '');
                const celLink = celLimpio.length >= 7
                    ? '<a href="https://wa.me/591' + esc(celLimpio) + '" target="_blank" rel="noopener" style="color:var(--blue);text-decoration:none;font-weight:bold;">' + esc(c.cel) + '</a>'
                    : '-';

                card.innerHTML = `
                    <div class="cliente-card-header" style="cursor:pointer;user-select:none;" data-toggle="${idDesplegable}">
                        <div style="display:flex;align-items:center;gap:8px;">
                            <svg class="flecha-toggle" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:18px;height:18px;transition:transform 0.3s;"><polyline points="6 9 12 15 18 9"/></svg>
                            <span class="nombre">${esc(c.n) || 'SIN NOMBRE'}</span>
                        </div>
                        <span class="badge ${tienePend ? 'badge-pendiente' : 'badge-devuelto'}">${tienePend ? '⏳ PENDIENTES' : '✅ AL DÍA'}</span>
                    </div>
                    <div class="cliente-card-info" style="border-bottom:1px dashed var(--pink-light);">
                        <span><strong>CI:</strong> ${esc(c.ci)}</span>
                        <span><strong>CEL:</strong> ${celLink}</span>
                        <span><strong>TOTAL:</strong> ${c.alqs.length} alquiler(es)</span>
                    </div>
                    <div id="${idDesplegable}" style="display:none;"></div>
                `;

                // Construir alquileres sin innerHTML dinámico de datos del usuario
                const contenedorAlqs = card.querySelector('#' + idDesplegable);
                c.alqs.forEach(a => {
                    const item = document.createElement('div');
                    item.className = 'alquiler-item' + (a.Estado === 'Devuelto' ? ' devuelto' : '');

                    const estadoClass = a.Estado === 'Alquilado' ? 'estado-alquilado' : 'estado-devuelto';
                    const estadoIcon = a.Estado === 'Alquilado' ? '🔴 ALQUILADO' : '🟢 DEVUELTO';

                    let garantiaTexto = '💰 Bs. ' + esc(a.PrecioAlquiler || '0');
                    if (a.GarantiaDinero && a.GarantiaDinero != '0') garantiaTexto += ' | 🛡️ Bs. ' + esc(a.GarantiaDinero);
                    if (a.GarantiaObjeto) garantiaTexto += ' + ' + esc(a.GarantiaObjeto);

                    item.innerHTML = `
                        <div class="alquiler-top">
                            <span class="disfraz">${esc(a.Disfraz)}</span>
                            <span class="estado ${estadoClass}">${estadoIcon}</span>
                        </div>
                        <div style="font-size:0.8rem;color:#666;margin-bottom:8px;">
                            📅 <strong>Registro:</strong> ${formatearFechaHora(a.FechaRegistro || a.FechaAlquiler)}<br>
                            📅 <strong>Devolver:</strong> ${formatearFecha(a.FechaDevolucion)}
                        </div>
                        <div class="alquiler-detalles" style="font-size:0.8rem;margin-bottom:8px;">${garantiaTexto}</div>
                        <div class="alquiler-acciones"></div>
                    `;

                    const acciones = item.querySelector('.alquiler-acciones');

                    if (a.Estado === 'Alquilado') {
                        const btnDev = document.createElement('button');
                        btnDev.className = 'btn-devolucion-item';
                        btnDev.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> DEVOLVER';
                        btnDev.addEventListener('click', () => {
                            iniciarDevolucionCliente(a.fila, a.Nombre || '', a.Disfraz || '', a.GarantiaDinero, a.GarantiaObjeto || '');
                        });
                        acciones.appendChild(btnDev);
                    }

                    const btnRec = document.createElement('button');
                    btnRec.className = 'btn-recibo-item';
                    btnRec.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg> RECIBO';
                    btnRec.addEventListener('click', () => mostrarReciboDesdeBusqueda(a));
                    acciones.appendChild(btnRec);

                    contenedorAlqs.appendChild(item);
                });

                // Toggle desplegable
                const header = card.querySelector('.cliente-card-header');
                header.addEventListener('click', () => {
                    const div = card.querySelector('#' + idDesplegable);
                    const flecha = header.querySelector('.flecha-toggle');
                    const abierto = div.style.display !== 'none';
                    div.style.display = abierto ? 'none' : 'block';
                    if (flecha) flecha.style.transform = abierto ? 'rotate(0deg)' : 'rotate(180deg)';
                });

                resultado.appendChild(card);
            });
        }
    };

    // Botón cargar
    const btnCargar = document.getElementById('btn-cargar-busqueda');
    if (btnCargar) {
        btnCargar.addEventListener('click', async () => {
            btnCargar.disabled = true;
            const textoOriginal = btnCargar.querySelector('.btn-cargar-texto');
            if (textoOriginal) textoOriginal.textContent = 'Cargando...';
            await cargarDatosAutomaticamente();
            if (renderBuscarCliente) renderBuscarCliente(datosBuscarCliente);
            btnCargar.disabled = false;
            if (textoOriginal) textoOriginal.textContent = 'Cargar datos';
        });
    }

    const btnClear = document.getElementById('buscar-cliente-clear');
    const input = document.getElementById('buscar-cliente-input');
    if (btnClear && input) {
        btnClear.addEventListener('click', () => {
            input.value = '';
            btnClear.style.display = 'none';
            if (renderBuscarCliente) renderBuscarCliente(datosBuscarCliente);
            input.focus();
        });
    }
}

// ========================================
// MODAL DE DEVOLUCIÓN
// ========================================

window.iniciarDevolucionCliente = function (fila, nombre, disfraz, gDin, gObj) {
    registroSeleccionado = { fila, nombre, disfraz, gDin, gObj };

    // Info cliente/disfraz
    const infoEl = document.getElementById('info-devolucion-cliente');
    if (infoEl) {
        infoEl.innerHTML = '<strong>' + esc(nombre) + '</strong><br><span style="color:var(--text-light);font-size:0.9rem;">' + esc(disfraz) + '</span>';
    }

    // Garantía
    const garantiaEl = document.getElementById('garantia-devolver-texto-cliente');
    const garantiaBox = document.getElementById('dev-garantia-box');
    if (garantiaEl && garantiaBox) {
        const dinStr = (gDin && Number(gDin) > 0) ? 'Bs. ' + gDin : '';
        const objStr = gObj ? gObj : '';
        const texto = [dinStr, objStr].filter(Boolean).join(' + ');
        if (texto) {
            garantiaEl.textContent = texto;
            garantiaBox.style.display = 'flex';
        } else {
            garantiaBox.style.display = 'none';
        }
    }

    // Reset estado a Excelente
    const grupo = document.getElementById('dev-estado-grupo');
    if (grupo) {
        grupo.querySelectorAll('.dev-estado-btn').forEach(b => b.classList.remove('active'));
        grupo.querySelector('[data-estado="Excelente"]')?.classList.add('active');
    }
    const hiddenEstado = document.getElementById('condiciones-devolucion-cliente');
    if (hiddenEstado) hiddenEstado.value = 'Excelente';

    // Reset notas
    const notas = document.getElementById('notas-devolucion-cliente');
    if (notas) notas.value = '';

    const modal = document.getElementById('modal-devolucion-cliente');
    if (modal) {
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }
};

function cerrarModalDevolucion() {
    const modal = document.getElementById('modal-devolucion-cliente');
    if (modal) modal.style.display = 'none';
    document.body.style.overflow = '';
    registroSeleccionado = null;
}

function configurarModalDevolucion() {
    document.getElementById('btn-cancelar-devolucion-cliente')?.addEventListener('click', cerrarModalDevolucion);

    // Botones de estado
    const grupo = document.getElementById('dev-estado-grupo');
    if (grupo) {
        grupo.querySelectorAll('.dev-estado-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                grupo.querySelectorAll('.dev-estado-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const hidden = document.getElementById('condiciones-devolucion-cliente');
                if (hidden) hidden.value = btn.dataset.estado;
            });
        });
    }

    // Cerrar al hacer click en el fondo
    const modal = document.getElementById('modal-devolucion-cliente');
    if (modal) {
        modal.addEventListener('click', e => {
            if (e.target === modal) cerrarModalDevolucion();
        });
    }

    const btnConfirmarDev = document.getElementById('btn-confirmar-devolucion-cliente');
    if (btnConfirmarDev) {
        configurarHold(btnConfirmarDev, async () => {
            if (!registroSeleccionado) return;
            btnConfirmarDev.disabled = true;
            const svgOrig = btnConfirmarDev.innerHTML;
            btnConfirmarDev.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;animation:spin 0.8s linear infinite"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg> Procesando...';

            try {
                const resp = await fetch(APPS_SCRIPT_URL, {
                    method: 'POST',
                    body: JSON.stringify({
                        accion: 'devolucion',
                        fila: registroSeleccionado.fila,
                        condiciones: document.getElementById('condiciones-devolucion-cliente')?.value || '',
                        notas: document.getElementById('notas-devolucion-cliente')?.value || ''
                    })
                });
                if (!resp.ok) throw new Error('Error del servidor: ' + resp.status);

                mostrarToast('Devolución registrada con éxito', 'exito');
                cerrarModalDevolucion();
                cargarDatosAutomaticamente();

            } catch (e) {
                mostrarToast('Error al registrar: ' + (e.message || 'Intentá de nuevo'), 'error', 5000);
                btnConfirmarDev.disabled = false;
                btnConfirmarDev.innerHTML = svgOrig;
            }
        }, 800);
    }
}

// ========================================
// TECLAS GLOBALES (ESC cierra modales)
// ========================================

function configurarTeclasGlobales() {
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') {
            // Cerrar modal devolución
            const modalDev = document.getElementById('modal-devolucion-cliente');
            if (modalDev && modalDev.style.display !== 'none') {
                cerrarModalDevolucion();
                return;
            }
            // Cerrar modal recibo (solo si no hay confirmación pendiente)
            const modalRecibo = document.getElementById('modal-recibo');
            if (modalRecibo && modalRecibo.style.display !== 'none' && !datosPendientes) {
                cerrarModalRecibo();
                return;
            }
        }
    });
}

// ========================================
// RECIBO TÉRMICO
// ========================================

function generarNumeroRecibo() {
    const f = new Date();
    const partes = new Intl.DateTimeFormat('es-BO', {
        timeZone: 'America/La_Paz',
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        hour12: false
    }).formatToParts(f);

    const p = {};
    partes.forEach(x => p[x.type] = x.value);
    return 'DF' + p.year + p.month + p.day + '-' + p.hour + p.minute + p.second;
}

window.mostrarReciboDesdeBusqueda = function (a) {
    mostrarRecibo({
        nombre: a.Nombre, cedula: a.Cedula, celular: a.Celular, disfraz: a.Disfraz,
        precio: a.PrecioAlquiler, pagoTipo: a.MetodoPago,
        fechaAlq: a.FechaAlquiler, fechaDev: a.FechaDevolucion,
        condiciones: a.Condiciones, garantiaDin: a.GarantiaDinero,
        garantiaPagoTipo: a.MetodoPagoGarantia, garantiaObj: a.GarantiaObjeto,
        recibo: a.NumeroRecibo
    }, false);
};

window.mostrarRecibo = function (d, esVistaPrevia, esConfirmacion = false) {
    if (!d) return;

    // Alternar entre modo confirmación y modo vista
    const actionsConfirmar = document.getElementById('recibo-actions-confirmar');
    const actionsVista = document.getElementById('recibo-actions-vista');
    if (actionsConfirmar) actionsConfirmar.style.display = esConfirmacion ? 'flex' : 'none';
    if (actionsVista) actionsVista.style.display = esConfirmacion ? 'none' : 'flex';

    const f = new Date();
    const fechaFooter = new Intl.DateTimeFormat('es-BO', { timeZone: 'America/La_Paz', year: 'numeric', month: '2-digit', day: '2-digit' }).format(f);
    const horaFooter = new Intl.DateTimeFormat('es-BO', { timeZone: 'America/La_Paz', hour: '2-digit', minute: '2-digit', hour12: false }).format(f);

    const cont = document.getElementById('recibo-contenido');
    if (!cont) return;

    const garantiaStr = 'Bs. ' + esc(d.garantiaDin || '0') + (d.garantiaObj ? ' + ' + esc(d.garantiaObj) : '');

    // Texto de método de pago alquiler
    let pagoAlqStr = esc(d.pagoTipo || 'Efectivo');
    if ((d.pagoTipo || '') === 'Mixto' && (d.precioEfectivo || d.precioQr)) {
        pagoAlqStr += ' (Ef. Bs.' + esc(d.precioEfectivo || '0') + ' + QR Bs.' + esc(d.precioQr || '0') + ')';
    }

    // Texto de método de pago garantía
    let pagoGarStr = '';
    if (parseFloat(d.garantiaDin || 0) > 0) {
        pagoGarStr = ' — ' + esc(d.garantiaPagoTipo || 'Efectivo');
        if ((d.garantiaPagoTipo || '') === 'Mixto' && (d.garantiaEfectivo || d.garantiaQr)) {
            pagoGarStr += ' (Ef. Bs.' + esc(d.garantiaEfectivo || '0') + ' + QR Bs.' + esc(d.garantiaQr || '0') + ')';
        }
    }

    cont.innerHTML = `
        <div class="recibo-header">
            <div class="recibo-brand">DISFRACES FANTASÍA</div>
            <div class="recibo-sub">Ayacucho, Oruro - 76133121</div>
        </div>
        ${esVistaPrevia
            ? '<div class="recibo-numero" style="color:#ff6b6b;">VISTA PREVIA</div>'
            : '<div class="recibo-numero">N° ' + esc(d.recibo || 'NUEVO') + '</div>'}
        <div class="recibo-cliente">
            <div class="cliente-nombre">${esc(d.nombre) || '-'}</div>
            <div class="cliente-dato">CI: ${esc(d.cedula) || '-'} - Cel: ${esc(d.celular) || '-'}</div>
        </div>
        <div class="recibo-disfraz">
            <div class="disfraz-nombre">${esc(d.disfraz) || '-'}</div>
        </div>
        <div class="recibo-fechas">
            <div class="fecha-item"><div class="fecha-label">Alquiler</div><div class="fecha-valor">${formatearFecha(d.fechaAlq)}</div></div>
            <div class="fecha-item"><div class="fecha-label">Devolución</div><div class="fecha-valor">${formatearFecha(d.fechaDev)}</div></div>
        </div>
        <div class="recibo-garantia">
            <div class="garantia-label">Garantía</div>
            <div class="garantia-valor">${garantiaStr}${pagoGarStr}</div>
        </div>
        <div class="recibo-total">
            <div class="total-label">ALQUILER</div>
            <div class="total-monto">Bs. ${esc(d.precio || '0')}</div>
        </div>
        <div class="recibo-total" style="font-size:0.82rem;padding-top:0.2rem;border-top:none;margin-top:-0.3rem;">
            <div class="total-label" style="font-size:0.75rem;opacity:0.7;">Pago</div>
            <div class="total-monto" style="font-size:0.82rem;color:var(--purple);">${pagoAlqStr}</div>
        </div>
        <div class="recibo-firma"><div class="firma-linea"></div><div class="firma-texto">Firma del Cliente</div></div>
        <div class="recibo-condiciones">Me comprometo a devolver el disfraz en la fecha acordada.</div>
        <div class="recibo-footer">
            <div class="footer-gracias">GRACIAS POR SU PREFERENCIA</div>
            <div class="footer-fecha">${fechaFooter} - ${horaFooter}</div>
        </div>
    `;

    const modalRecibo = document.getElementById('modal-recibo');
    if (modalRecibo) modalRecibo.style.display = 'flex';
};

function configurarEventosRecibo() {
    // Vista previa manual (botón del formulario)
    document.getElementById('btn-vista-previa')?.addEventListener('click', () => {
        mostrarRecibo(leerDatosFormulario(), true, false);
    });

    // Imprimir recibo del último registro guardado
    document.getElementById('btn-imprimir-recibo')?.addEventListener('click', () => mostrarRecibo(ultimoRegistro, false, false));

    // Imprimir
    document.getElementById('btn-print-recibo')?.addEventListener('click', () => {
        setTimeout(() => window.print(), 100);
    });

    // Cerrar (modo vista)
    document.getElementById('btn-cerrar-recibo')?.addEventListener('click', cerrarModalRecibo);

    // Cancelar (modo confirmación) — vuelve al formulario sin guardar
    document.getElementById('btn-cancelar-registro')?.addEventListener('click', () => {
        datosPendientes = null;
        cerrarModalRecibo();
    });

    // CONFIRMAR Y GUARDAR
    document.getElementById('btn-confirmar-registro')?.addEventListener('click', async () => {
        if (!datosPendientes) return;

        const btn = document.getElementById('btn-confirmar-registro');
        const btnTexto = btn.querySelector('.btn-confirmar-texto');
        const btnLoading = btn.querySelector('.btn-confirmar-loading');
        btn.disabled = true;
        if (btnTexto) btnTexto.style.display = 'none';
        if (btnLoading) btnLoading.style.display = 'inline';

        try {
            const resp = await fetch(APPS_SCRIPT_URL, {
                method: 'POST',
                body: JSON.stringify(datosPendientes)
            });
            if (!resp.ok) throw new Error('Error del servidor: ' + resp.status);

            datosPendientes.recibo = generarNumeroRecibo();
            ultimoRegistro = datosPendientes;
            datosPendientes = null;

            // Cambiar el modal a modo vista con el recibo real (ya guardado)
            mostrarRecibo(ultimoRegistro, false, false);

            mostrarToast('¡Alquiler registrado exitosamente!', 'exito');

            const formRegistro = document.getElementById('form-registro');
            const btnImprimir = document.getElementById('btn-imprimir-recibo');
            const btnPrevia = document.getElementById('btn-vista-previa');
            if (btnImprimir) btnImprimir.style.display = 'inline-flex';
            if (btnPrevia) btnPrevia.style.display = 'none';
            if (formRegistro) {
                formRegistro.reset();
                configurarFechas();
                resetBotonesPago();
                ocultarAlertas();
            }

            cargarDatosAutomaticamente();

        } catch (err) {
            mostrarToast('Error al guardar: ' + (err.message || 'Intentá de nuevo'), 'error', 5000);
            cerrarModalRecibo();
        }

        btn.disabled = false;
        if (btnTexto) { btnTexto.style.display = 'inline'; }
        if (btnLoading) btnLoading.style.display = 'none';
    });

    // Cerrar al click en el fondo — solo si NO es confirmación pendiente
    const modalRecibo = document.getElementById('modal-recibo');
    if (modalRecibo) {
        modalRecibo.addEventListener('click', e => {
            if (e.target !== modalRecibo) return;
            if (datosPendientes) return; // No cerrar si hay datos sin guardar
            cerrarModalRecibo();
        });
    }
}

function cerrarModalRecibo() {
    const m = document.getElementById('modal-recibo');
    if (m) m.style.display = 'none';
}

// ========================================
// TABLA DE HISTORIAL
// ========================================

function mostrarHistorial(registros) {
    const contenedor = document.getElementById('tabla-historial');
    if (!contenedor) return;

    if (!registros || !registros.length) {
        contenedor.innerHTML = '<p class="placeholder-text">No hay registros cargados</p>';
        return;
    }

    const filtro = (document.getElementById('filtro-estado')?.value || 'todos').toLowerCase();

    const filtrados = (filtro === 'todos'
        ? [...registros]
        : registros.filter(r => (r.Estado || '').toString().trim().toLowerCase() === filtro)
    ).sort((a, b) => b.fila - a.fila);

    if (!filtrados.length) {
        contenedor.innerHTML = '<p class="placeholder-text">Sin registros para este filtro</p>';
        return;
    }

    contenedor.innerHTML = '';

    filtrados.forEach(r => {
        const estado = (r.Estado || '').toString().trim();
        const esAlquilado = estado.toLowerCase() === 'alquilado';
        const hoy = fechaBoliviaHoy();
        const fechaDevStr = fechaParaComparar(r.FechaDevolucion);
        const vencido = esAlquilado && fechaDevStr && fechaDevStr < hoy;

        const card = document.createElement('div');
        card.className = 'hist-card' + (esAlquilado ? ' hist-card-activo' : ' hist-card-devuelto') + (vencido ? ' hist-card-vencido' : '');

        const metodoPago = r.MetodoPago ? '<span class="hist-metodo">' + esc(r.MetodoPago) + '</span>' : '';
        const garantia = [];
        if (r.GarantiaDinero && r.GarantiaDinero !== '0') garantia.push('Bs. ' + esc(r.GarantiaDinero));
        if (r.GarantiaObjeto) garantia.push(esc(r.GarantiaObjeto));
        const garantiaStr = garantia.length ? garantia.join(' + ') : '—';

        card.innerHTML =
            '<div class="hist-card-top">' +
                '<div class="hist-nombre">' + esc(r.Nombre || '—') + '</div>' +
                '<span class="hist-estado ' + (esAlquilado ? 'hist-estado-activo' : 'hist-estado-dev') + (vencido ? ' hist-estado-vencido' : '') + '">' +
                    (vencido ? '⚠️ VENCIDO' : esAlquilado ? '🔴 ALQUILADO' : '✅ DEVUELTO') +
                '</span>' +
            '</div>' +
            '<div class="hist-disfraz">🎭 ' + esc(r.Disfraz || '—') + '</div>' +
            '<div class="hist-card-info">' +
                '<span>👤 CI: ' + esc(r.Cedula || '—') + '</span>' +
                '<span>📅 Alquiler: ' + formatearFecha(r.FechaAlquiler) + '</span>' +
                '<span>🔔 Devolución: ' + formatearFecha(r.FechaDevolucion) + '</span>' +
                '<span>💰 Bs. ' + esc(r.PrecioAlquiler || '0') + ' ' + metodoPago + '</span>' +
                '<span>🛡️ ' + garantiaStr + '</span>' +
            '</div>';

        contenedor.appendChild(card);
    });
}

// ========================================
// HABITUALES — RANKING DE CLIENTES
// ========================================

function parseFechaSheet(s) {
    const p = _parsearFecha(s);
    if (!p) return new Date(0);
    const d = new Date(p.yyyy + '-' + p.mm + '-' + p.dd + (p.hh ? 'T' + p.hh + ':' + p.min : 'T00:00'));
    return isNaN(d.getTime()) ? new Date(0) : d;
}

function mostrarClientes(registros) {
    const contenedor = document.getElementById('tabla-clientes');
    if (!contenedor) return;

    if (!registros || !registros.length) {
        contenedor.innerHTML = '<p class="placeholder-text">No hay registros cargados</p>';
        return;
    }

    const clientes = {};
    registros.forEach(r => {
        const ci = (r.Cedula || 'S-CI').toString().trim();
        if (!clientes[ci]) {
            clientes[ci] = {
                nombre: r.Nombre || '—',
                ci,
                cel: r.Celular || '—',
                total: 0,
                activos: 0,
                ultTexto: r.FechaAlquiler || '',
                ultDate: parseFechaSheet(r.FechaAlquiler)
            };
        }
        clientes[ci].total++;
        if ((r.Estado || '').toString().trim().toLowerCase() === 'alquilado') {
            clientes[ci].activos++;
        }
        const d = parseFechaSheet(r.FechaAlquiler);
        if (d > clientes[ci].ultDate) {
            clientes[ci].ultDate = d;
            clientes[ci].ultTexto = r.FechaAlquiler || '';
        }
    });

    const lista = Object.values(clientes).sort((a, b) => b.total - a.total);

    contenedor.innerHTML = '';

    const tableEl = document.createElement('table');
    tableEl.className = 'tabla-registros';

    const thead = document.createElement('thead');
    thead.innerHTML =
        '<tr>' +
            '<th>#</th>' +
            '<th>Nombre</th>' +
            '<th>CI</th>' +
            '<th>Celular</th>' +
            '<th>Total</th>' +
            '<th>Activos</th>' +
            '<th>Último alquiler</th>' +
        '</tr>';
    tableEl.appendChild(thead);

    const tbody = document.createElement('tbody');
    lista.forEach((c, i) => {
        const tr = document.createElement('tr');

        const activosBadge = c.activos > 0
            ? '<span style="background:var(--red-soft);color:var(--red);border:1px solid var(--red);padding:0.1rem 0.45rem;border-radius:8px;font-size:0.75rem;font-weight:800;">🔴 ' + c.activos + '</span>'
            : '<span style="color:#bbb;">—</span>';

        // Último: formatear desde ultDate (Date object) para evitar textos corruptos
        let ultDisplay = '—';
        if (c.ultDate && c.ultDate.getTime() > 0) {
            const parts = new Intl.DateTimeFormat('en-GB', {
                timeZone: 'America/La_Paz',
                day: '2-digit', month: '2-digit', year: 'numeric'
            }).formatToParts(c.ultDate);
            const get = t => parts.find(x => x.type === t)?.value || '00';
            ultDisplay = get('day') + '/' + get('month') + '/' + get('year');
        }

        const medalla = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : (i + 1);

        tr.innerHTML =
            '<td style="text-align:center;font-size:1rem;">' + medalla + '</td>' +
            '<td><strong>' + esc(c.nombre) + '</strong></td>' +
            '<td style="color:var(--text-light);font-size:0.85rem;">' + esc(c.ci) + '</td>' +
            '<td style="font-size:0.85rem;">' + esc(c.cel) + '</td>' +
            '<td style="text-align:center;"><strong style="color:var(--purple);font-size:1rem;">' + c.total + '</strong></td>' +
            '<td style="text-align:center;">' + activosBadge + '</td>' +
            '<td style="font-size:0.82rem;color:var(--text-light);white-space:nowrap;">' + esc(ultDisplay) + '</td>';

        tbody.appendChild(tr);
    });

    tableEl.appendChild(tbody);
    contenedor.appendChild(tableEl);
}

// ========================================
// ESTADÍSTICAS
// ========================================

function fechaBoliviaHoy() {
    const p = new Intl.DateTimeFormat('en-GB', { timeZone: 'America/La_Paz', year: 'numeric', month: '2-digit', day: '2-digit' })
        .format(new Date()).split('/');
    return p[2] + '-' + p[1] + '-' + p[0];
}

function configurarEstadisticas() {
    const hoy = fechaBoliviaHoy();
    const primerDiaMes = hoy.slice(0, 7) + '-01';

    // Atajos de fecha
    document.getElementById('btn-stats-hoy')?.addEventListener('click', () => {
        document.getElementById('est-fecha-desde').value = hoy;
        document.getElementById('est-fecha-hasta').value = hoy;
        calcularEstadisticas();
    });
    document.getElementById('btn-stats-mes')?.addEventListener('click', () => {
        document.getElementById('est-fecha-desde').value = primerDiaMes;
        document.getElementById('est-fecha-hasta').value = hoy;
        calcularEstadisticas();
    });
    document.getElementById('btn-stats-todo')?.addEventListener('click', () => {
        document.getElementById('est-fecha-desde').value = '';
        document.getElementById('est-fecha-hasta').value = '';
        calcularEstadisticas();
    });
    document.getElementById('btn-calcular-stats')?.addEventListener('click', calcularEstadisticas);
}

function bs(n) { return 'Bs. ' + n.toLocaleString('es-BO', { minimumFractionDigits: 0, maximumFractionDigits: 2 }); }

function calcularEstadisticas() {
    if (!datosCargados) {
        mostrarToast('Primero cargá los datos desde la pestaña Buscar Cliente', 'error');
        return;
    }

    const desde = document.getElementById('est-fecha-desde').value;
    const hasta = document.getElementById('est-fecha-hasta').value;
    const hoy = fechaBoliviaHoy();

    let registros = datosBuscarCliente;
    if (desde) registros = registros.filter(r => fechaParaComparar(r.FechaAlquiler) >= desde);
    if (hasta) registros = registros.filter(r => fechaParaComparar(r.FechaAlquiler) <= hasta);

    // ── ACUMULADORES ────────────────────────────────────────
    let totalAlquileres = registros.length;
    let ingresosAlquiler = 0;          // cobrado por alquiler (todos los estados)

    // Caja alquiler por método
    let alqEfectivo = 0, alqQr = 0, alqMixto = 0;

    // Garantías dinero PENDIENTES (solo alquilados = aún no devueltas)
    let garDinPendiente = 0;           // lo que tenés que devolver al cliente
    let garEfectivoPend = 0;
    let garQrPend = 0;
    let garMixtoPend = 0;

    let alquiladosActivos = 0;
    let devueltos = 0;
    let vencidos = 0;
    let garantiasObjetos = [];
    const disfracesFrecuentes = {};

    registros.forEach(r => {
        const precio  = parseFloat(r.PrecioAlquiler)  || 0;
        const gar     = parseFloat(r.GarantiaDinero)  || 0;
        const metodoAlq = (r.MetodoPago         || '').trim().toLowerCase();
        const metodoGar = (r.MetodoPagoGarantia || '').trim().toLowerCase();
        const estado    = (r.Estado             || '').trim().toLowerCase();

        ingresosAlquiler += precio;

        // Método de pago alquiler
        if      (metodoAlq === 'qr')    alqQr      += precio;
        else if (metodoAlq === 'mixto') alqMixto   += precio;
        else                            alqEfectivo += precio;

        if (estado === 'alquilado') {
            alquiladosActivos++;

            // Garantía dinero pendiente (sigue en poder del negocio)
            if (gar > 0) {
                garDinPendiente += gar;
                if      (metodoGar === 'qr')    garQrPend      += gar;
                else if (metodoGar === 'mixto') garMixtoPend   += gar;
                else                            garEfectivoPend += gar;
            }
            if (r.GarantiaObjeto && r.GarantiaObjeto.trim())
                garantiasObjetos.push({ nombre: r.Nombre, objeto: r.GarantiaObjeto, disfraz: r.Disfraz, fechaDev: r.FechaDevolucion });

            const fDev = fechaParaComparar(r.FechaDevolucion);
            if (fDev && fDev < hoy) vencidos++;

        } else if (estado === 'devuelto') {
            devueltos++;
        }

        const dis = (r.Disfraz || '').toUpperCase();
        if (dis) disfracesFrecuentes[dis] = (disfracesFrecuentes[dis] || 0) + 1;
    });

    const topDisfraces = Object.entries(disfracesFrecuentes).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const rangoTexto = desde || hasta
        ? (desde ? formatearFecha(desde) : '...') + ' → ' + (hasta ? formatearFecha(hasta) : '...')
        : 'Todo el historial';

    // ── RENDER ───────────────────────────────────────────────
    const cont = document.getElementById('est-contenido');
    if (!cont) return;
    cont.innerHTML = '';

    // Encabezado de período
    const header = document.createElement('div');
    header.className = 'est-periodo';
    header.innerHTML = '📆 <strong>' + rangoTexto + '</strong> · ' + totalAlquileres + ' registros';
    cont.appendChild(header);

    // ── BLOQUE 1: RESUMEN GENERAL ────────────────────────────
    agregarTitulo(cont, '📊 Resumen general');
    const grid1 = crearGrid(cont);
    agregarCard(grid1, 'pink',   '🎭', totalAlquileres,          'Total alquileres');
    agregarCard(grid1, 'green',  '💰', bs(ingresosAlquiler),     'Ingresos por alquiler');
    agregarCard(grid1, 'purple', '⏳', alquiladosActivos,        'En curso');
    agregarCard(grid1, 'blue',   '✅', devueltos,                'Devueltos');
    agregarCard(grid1, 'red',    '⚠️', vencidos,                 'Vencidos sin devolver');

    // ── BLOQUE 2: CAJA — LO QUE TENÉS QUE TENER ────────────
    agregarTitulo(cont, '💵 Caja — Lo que tenés que tener');
    const notaCaja = document.createElement('p');
    notaCaja.className = 'est-nota';
    notaCaja.textContent = 'Total recibido por alquiler, separado por cómo te pagaron.';
    cont.appendChild(notaCaja);
    const grid2 = crearGrid(cont, 3);
    agregarCard(grid2, 'green',  '💵', bs(alqEfectivo),  'Efectivo recibido',  'Billetes en mano');
    agregarCard(grid2, 'blue',   '📱', bs(alqQr),        'QR recibido',        'En tu cuenta QR');
    agregarCard(grid2, 'purple', '🔀', bs(alqMixto),     'Mixto recibido',     'Parcial ef. + QR');

    // Total caja
    const totalCaja = document.createElement('div');
    totalCaja.className = 'est-total-caja';
    totalCaja.innerHTML =
        '<span class="est-total-label">TOTAL EN CAJA</span>' +
        '<span class="est-total-valor">' + bs(ingresosAlquiler) + '</span>';
    cont.appendChild(totalCaja);

    // ── BLOQUE 3: GARANTÍAS DINERO — LO QUE TENÉS QUE APARTAR ──
    if (garDinPendiente > 0) {
        agregarTitulo(cont, '🔒 Garantías en dinero — Lo que tenés que apartar');
        const notaGar = document.createElement('p');
        notaGar.className = 'est-nota';
        notaGar.textContent = 'Este dinero NO es tuyo aún. Lo devolvés cuando el cliente retorne el disfraz.';
        cont.appendChild(notaGar);
        const grid3 = crearGrid(cont, 3);
        agregarCard(grid3, 'yellow', '💵', bs(garEfectivoPend), 'Garantía efectivo',  'Apartado en billetes');
        agregarCard(grid3, 'blue',   '📱', bs(garQrPend),       'Garantía QR',        'Apartado en cuenta');
        agregarCard(grid3, 'purple', '🔀', bs(garMixtoPend),    'Garantía mixto',     'Ef. + QR');

        const totalApartar = document.createElement('div');
        totalApartar.className = 'est-total-caja est-total-amarillo';
        totalApartar.innerHTML =
            '<span class="est-total-label">TOTAL A DEVOLVER EN GARANTÍAS</span>' +
            '<span class="est-total-valor">' + bs(garDinPendiente) + '</span>';
        cont.appendChild(totalApartar);
    }

    // ── BLOQUE 4: OBJETOS EN GARANTÍA ───────────────────────
    if (garantiasObjetos.length > 0) {
        agregarTitulo(cont, '📦 Objetos en garantía (' + garantiasObjetos.length + ')');
        const listaGar = document.createElement('div');
        listaGar.className = 'est-lista-garantias';
        garantiasObjetos.forEach(g => {
            const fDev = fechaParaComparar(g.fechaDev);
            const esVencido = fDev && fDev < hoy;
            const item = document.createElement('div');
            item.className = 'est-garantia-item' + (esVencido ? ' est-garantia-vencida' : '');
            item.innerHTML =
                '<span class="est-gar-objeto">' + esc(g.objeto) + (esVencido ? ' ⚠️' : '') + '</span>' +
                '<span class="est-gar-info">' + esc(g.nombre) + ' · ' + esc(g.disfraz) + '</span>' +
                '<span class="est-gar-fecha">Dev: ' + formatearFecha(g.fechaDev) + '</span>';
            listaGar.appendChild(item);
        });
        cont.appendChild(listaGar);
    }

    // ── BLOQUE 5: TOP DISFRACES ──────────────────────────────
    if (topDisfraces.length > 0) {
        agregarTitulo(cont, '🎭 Disfraces más alquilados');
        const ranking = document.createElement('div');
        ranking.className = 'est-ranking';
        topDisfraces.forEach(([nombre, total], i) => {
            const item = document.createElement('div');
            item.className = 'est-ranking-item';
            item.innerHTML =
                '<span class="est-rank-pos">' + (i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : (i+1)) + '</span>' +
                '<span class="est-rank-nombre">' + esc(nombre) + '</span>' +
                '<span class="est-rank-val">' + total + 'x</span>';
            ranking.appendChild(item);
        });
        cont.appendChild(ranking);
    }
}

function agregarTitulo(cont, texto) {
    const t = document.createElement('div');
    t.className = 'est-seccion-titulo';
    t.textContent = texto;
    cont.appendChild(t);
}

function crearGrid(cont, cols) {
    const g = document.createElement('div');
    g.className = cols === 3 ? 'est-grid est-grid-3' : 'est-grid';
    cont.appendChild(g);
    return g;
}

function agregarCard(grid, color, icon, valor, label, sub) {
    const c = document.createElement('div');
    c.className = 'est-card est-card-' + color;
    c.innerHTML =
        '<div class="est-card-icon">' + icon + '</div>' +
        '<div class="est-card-valor">' + valor + '</div>' +
        '<div class="est-card-label">' + label + '</div>' +
        (sub ? '<div class="est-card-sub">' + sub + '</div>' : '');
    grid.appendChild(c);
}

// ========================================
// TABS
// ========================================

function configurarTabs() {
    const btnHistorial = document.getElementById('btn-cargar-historial');
    if (btnHistorial) {
        btnHistorial.addEventListener('click', () => {
            if (datosCargados) mostrarHistorial(datosBuscarCliente);
            else mostrarToast('Primero cargá los datos desde la pestaña Buscar Cliente', 'error');
        });
    }

    const filtroEstado = document.getElementById('filtro-estado');
    if (filtroEstado) {
        filtroEstado.addEventListener('change', () => {
            if (datosCargados) mostrarHistorial(datosBuscarCliente);
        });
    }

    const btnClientes = document.getElementById('btn-cargar-clientes');
    if (btnClientes) {
        btnClientes.addEventListener('click', () => {
            if (datosCargados) mostrarClientes(datosBuscarCliente);
            else mostrarToast('Primero cargá los datos desde la pestaña Buscar Cliente', 'error');
        });
    }

    configurarEstadisticas();

    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn, .tab-content').forEach(el => el.classList.remove('active'));
            btn.classList.add('active');
            const tabId = 'tab-' + btn.dataset.tab;
            const tab = document.getElementById(tabId);
            if (tab) tab.classList.add('active');

            if (datosCargados) actualizarVistasSecundarias();
        });
    });
}

// ========================================
// FECHAS
// ========================================

function configurarFechas() {
    const formatter = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'America/La_Paz',
        year: 'numeric', month: '2-digit', day: '2-digit'
    });
    const hoy = new Date();
    const p1 = formatter.format(hoy).split('/');
    const hoyBolivia = p1[2] + '-' + p1[1] + '-' + p1[0];

    const dev = new Date();
    dev.setDate(hoy.getDate() + 3);
    const p2 = formatter.format(dev).split('/');
    const devBolivia = p2[2] + '-' + p2[1] + '-' + p2[0];

    const fa = document.getElementById('fecha-alquiler');
    const fd = document.getElementById('fecha-devolucion');
    if (fa) fa.value = hoyBolivia;
    if (fd) fd.value = devBolivia;
}

// ========================================
// CONEXIÓN
// ========================================

function verificarConexion() {
    const statusEl = document.getElementById('status');
    const statusText = document.getElementById('status-text');

    if (!APPS_SCRIPT_URL || APPS_SCRIPT_URL.includes('PEGAR_AQUI')) {
        if (statusEl) statusEl.className = 'status error';
        if (statusText) statusText.textContent = 'Falta URL';
        return;
    }

    fetch(APPS_SCRIPT_URL + '?accion=test')
        .then(r => r.json())
        .then(d => {
            if (d.exito) {
                sistemaListo = true;
                if (statusEl) statusEl.className = 'status conectado';
                if (statusText) statusText.textContent = 'Conectado';
            } else {
                if (statusEl) statusEl.className = 'status error';
                if (statusText) statusText.textContent = 'Error Servidor';
            }
        })
        .catch(() => {
            if (statusEl) statusEl.className = 'status error';
            if (statusText) statusText.textContent = 'Sin Conexión';
        });
}

// ========================================
// ESTADÍSTICAS
// ========================================

function calcularStats(registros) {
    if (!registros || !registros.length) return;

    const formatter = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'America/La_Paz',
        year: 'numeric', month: '2-digit', day: '2-digit'
    });
    const partes = formatter.format(new Date()).split('/');
    const hoyBolivia = partes[2] + '-' + partes[1] + '-' + partes[0];

    let hoyCount = 0;
    let pendientesCount = 0;
    let vencidosCount = 0;
    let devueltosCount = 0;

    registros.forEach(r => {
        const estado = (r.Estado || '').toString().trim().toLowerCase();
        const fechaAlqDB = fechaParaComparar(r.FechaAlquiler);
        const fechaDevDB = fechaParaComparar(r.FechaDevolucion);

        if (estado === 'alquilado') {
            if (fechaDevDB < hoyBolivia) {
                vencidosCount++;
            } else {
                pendientesCount++;
            }
        } else if (estado === 'devuelto') {
            devueltosCount++;
        }

        if (fechaAlqDB === hoyBolivia) hoyCount++;
    });

    const statHoy = document.getElementById('stat-hoy');
    const statPend = document.getElementById('stat-pendientes');
    const statDev = document.getElementById('stat-devueltos');

    if (statHoy) statHoy.textContent = hoyCount;
    if (statPend) {
        statPend.textContent = pendientesCount + (vencidosCount > 0 ? ' ⚠️' + vencidosCount : '');
        statPend.title = vencidosCount > 0 ? vencidosCount + ' vencido(s)' : '';
    }
    if (statDev) statDev.textContent = devueltosCount;
}
