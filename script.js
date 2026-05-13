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

// ========================================
// DOM LOADED (INICIO DEL SISTEMA)
// ========================================

document.addEventListener('DOMContentLoaded', () => {
    verificarConexion();
    configurarTabs();
    configurarFechas();
    configurarAutollenadoCI();
    configurarFormularioRegistro();
    configurarBuscarCliente();
    configurarModalDevolucion();
    configurarEventosRecibo();
    
    cargarDatosAutomaticamente(); // Carga inicial
    iniciarSincronizacionMultiusuario(); // INICIA LA SINCRONIZACIÓN ENTRE PANTALLAS
});

// ========================================
// CARGA AUTOMÁTICA Y SINCRONIZACIÓN MULTIPANTALLA
// ========================================

async function cargarDatosAutomaticamente() {
    if (!APPS_SCRIPT_URL || APPS_SCRIPT_URL.includes('PEGAR_AQUI')) return;
    
    const resBusqueda = document.getElementById('resultados-buscar-cliente');
    if (resBusqueda && !datosCargados) resBusqueda.innerHTML = '<div class="loading">Sincronizando base de datos...</div>';

    try {
        const r = await fetch(APPS_SCRIPT_URL + '?accion=listar');
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

// NUEVO: Revisa cambios en la nube cada 15 segundos para múltiples pantallas
function iniciarSincronizacionMultiusuario() {
    setInterval(async () => {
        if (!datosCargados || !APPS_SCRIPT_URL || APPS_SCRIPT_URL.includes('PEGAR_AQUI')) return;
        
        try {
            const r = await fetch(APPS_SCRIPT_URL + '?accion=listar');
            const d = await r.json();
            
            if (d.exito && d.registros) {
                // Compara si hay diferencias con lo que ya tenemos en pantalla
                const dataNueva = JSON.stringify(d.registros);
                const dataActual = JSON.stringify(datosBuscarCliente);
                
                if (dataNueva !== dataActual) {
                    console.log("🔄 Actualización detectada desde otra pantalla. Sincronizando...");
                    datosBuscarCliente = d.registros;
                    calcularStats(d.registros);
                    actualizarVistasSecundarias();
                    
                    // Si estás en la pestaña de buscar y no estás escribiendo nada, actualiza la lista
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
            // Falla silenciosa para no interrumpir al usuario si el internet parpadea
        }
    }, 15000); // 15 segundos
}

function actualizarVistasSecundarias() {
    const tabHistorial = document.getElementById('tab-historial');
    const tabHabituales = document.getElementById('tab-habituales');
    if (tabHistorial && tabHistorial.classList.contains('active')) mostrarHistorial(datosBuscarCliente);
    if (tabHabituales && tabHabituales.classList.contains('active')) mostrarClientes(datosBuscarCliente);
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
    if (alertaHab) {
        document.getElementById('alerta-habitual-texto').innerHTML = `<strong>Cliente Habitual:</strong> ${registros.length} alquiler(es) previos.`;
        alertaHab.style.display = 'flex';
    }

    const alertaDeu = document.getElementById('alerta-deudas');
    if (alertaDeu) {
        if (pendientes.length > 0) {
            alertaDeu.innerHTML = `<strong>¡ATENCIÓN! Tiene ${pendientes.length} disfraz(es) sin devolver:</strong>` +
                `<ul class="deuda-lista">${pendientes.map(p => `<li>${p.Disfraz} (${formatearFecha(p.FechaDevolucion)})</li>`).join('')}</ul>`;
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
// REGISTRO DE NUEVO ALQUILER (CON HORA BOLIVIA)
// ========================================

function configurarFormularioRegistro() {
    const formRegistro = document.getElementById('form-registro');
    if (!formRegistro) return;

    formRegistro.addEventListener('submit', async e => {
        e.preventDefault();
        const btn = document.getElementById('btn-registrar');
        btn.disabled = true;
        btn.innerHTML = 'Registrando...';

        const fechaHoraBolivia = new Intl.DateTimeFormat('es-BO', {
            timeZone: 'America/La_Paz',
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit', second: '2-digit',
            hour12: false
        }).format(new Date());

        const datos = {
            nombre: document.getElementById('nombre').value.trim().toUpperCase(),
            cedula: document.getElementById('cedula').value.trim().toUpperCase(),
            celular: document.getElementById('celular').value.trim().toUpperCase(),
            disfraz: document.getElementById('disfraz').value.trim().toUpperCase(),
            precio: document.getElementById('precio').value || '0',
            fechaAlq: document.getElementById('fecha-alquiler').value,
            fechaDev: document.getElementById('fecha-devolucion').value,
            condiciones: document.getElementById('condiciones').value,
            garantiaDin: document.getElementById('garantia-dinero').value || '0',
            garantiaObj: document.getElementById('garantia-objeto').value.trim().toUpperCase(),
            obs: document.getElementById('observaciones').value.trim().toUpperCase(),
            fechaRegistro: fechaHoraBolivia 
        };

        try {
            await fetch(APPS_SCRIPT_URL, { method: 'POST', body: JSON.stringify(datos) });
            
            datos.recibo = generarNumeroRecibo();
            ultimoRegistro = datos;
            
            alert('✅ ¡Alquiler Registrado exitosamente!');
            
            document.getElementById('btn-imprimir-recibo').style.display = 'inline-flex';
            document.getElementById('btn-vista-previa').style.display = 'none';
            
            formRegistro.reset();
            configurarFechas();
            ocultarAlertas();
            cargarDatosAutomaticamente(); 
            
        } catch (err) {
            alert('Error al guardar: ' + err.message);
        }

        btn.disabled = false;
        btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg> <span class="btn-texto">Registrar Alquiler</span>';
    });

    formRegistro.addEventListener('reset', () => {
        document.getElementById('btn-imprimir-recibo').style.display = 'none';
        document.getElementById('btn-vista-previa').style.display = 'inline-flex';
        ocultarAlertas();
        setTimeout(configurarFechas, 10);
    });
}

// ========================================
// BUSCADOR ORDENADO DESPLEGABLE
// ========================================

function formatearFecha(cadena) {
    if (!cadena) return '-';
    if (cadena.includes('T')) {
        const partes = cadena.split('T')[0].split('-');
        return `${partes[2]}/${partes[1]}/${partes[0]}`; 
    }
    if (cadena.includes('-') && cadena.split('-')[0].length === 4) {
        const partes = cadena.split('-');
        return `${partes[2]}/${partes[1]}/${partes[0]}`;
    }
    return cadena;
}

window.filtrarCliente = function(valor) {
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
        (r.Disfraz || '').toString().toLowerCase().includes(q)
    );
    renderBuscarCliente(filtrados);
};

function configurarBuscarCliente() {
    const resultado = document.getElementById('resultados-buscar-cliente');
    const contador = document.getElementById('busqueda-contador');

    renderBuscarCliente = function(registros) {
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

        if (contador) contador.textContent = `${clientesArray.length} cliente(s)`;

        if (resultado) {
            resultado.innerHTML = clientesArray.map((c, idx) => {
                const tienePend = c.alqs.some(a => a.Estado === 'Alquilado');
                const idDesplegable = 'desplegable-cliente-' + idx;
                
                return `
                    <div class="cliente-card">
                        <div class="cliente-card-header" style="cursor: pointer; user-select: none;" onclick="
                            const div = document.getElementById('${idDesplegable}');
                            const flecha = this.querySelector('.flecha-toggle');
                            if(div.style.display === 'none') {
                                div.style.display = 'block';
                                flecha.style.transform = 'rotate(180deg)';
                            } else {
                                div.style.display = 'none';
                                flecha.style.transform = 'rotate(0deg)';
                            }
                        ">
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <svg class="flecha-toggle" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:18px; height:18px; transition: transform 0.3s; transform: rotate(0deg);"><polyline points="6 9 12 15 18 9"/></svg>
                                <span class="nombre">${c.n || 'SIN NOMBRE'}</span>
                            </div>
                            <span class="badge ${tienePend ? 'badge-pendiente' : 'badge-devuelto'}">${tienePend ? '⏳ PENDIENTES' : '✅ AL DÍA'}</span>
                        </div>
                        <div class="cliente-card-info" style="border-bottom: 1px dashed var(--pink-light);">
                            <span><strong>CI:</strong> ${c.ci}</span>
                            <span><strong>CEL:</strong> ${c.cel ? '<a href="https://wa.me/591' + String(c.cel).replace(/\\s+/g, '') + '" target="_blank" style="color: var(--blue); text-decoration: none; font-weight: bold;">' + c.cel + '</a>' : '-'}</span>
                            <span><strong>TOTAL:</strong> ${c.alqs.length} alquiler(es)</span>
                        </div>
                        
                        <div id="${idDesplegable}" style="display: none;">
                            ${c.alqs.map(a => `
                                <div class="alquiler-item ${a.Estado === 'Devuelto' ? 'devuelto' : ''}">
                                    <div class="alquiler-top">
                                        <span class="disfraz">${a.Disfraz}</span>
                                        <span class="estado ${a.Estado === 'Alquilado' ? 'estado-alquilado' : 'estado-devuelto'}">${a.Estado === 'Alquilado' ? '🔴 ALQUILADO' : '🟢 DEVUELTO'}</span>
                                    </div>
                                    
                                    <div style="font-size: 0.8rem; color: #666; margin-bottom: 8px;">
                                        📅 <strong>Registro:</strong> ${a.FechaRegistro || formatearFecha(a.FechaAlquiler)}<br>
                                        📅 <strong>Dev:</strong> ${formatearFecha(a.FechaDevolucion)}
                                    </div>
                                    
                                    <div class="alquiler-detalles" style="font-size:0.8rem; margin-bottom: 8px;">
                                        💰 Bs. ${a.PrecioAlquiler || '0'} 
                                        ${a.GarantiaDinero && a.GarantiaDinero != '0' ? '| 🛡️ Bs. ' + a.GarantiaDinero : ''}
                                        ${a.GarantiaObjeto ? '+ ' + a.GarantiaObjeto : ''}
                                    </div>
                                    <div class="alquiler-acciones">
                                        ${a.Estado === 'Alquilado' ? `<button class="btn-devolucion-item" onclick="iniciarDevolucionCliente(${a.fila},'${(a.Nombre||'').replace(/'/g,"\\'")}','${(a.Disfraz||'').replace(/'/g,"\\'")}','${a.GarantiaDinero}','${(a.GarantiaObjeto||'').replace(/'/g,"\\'")}')">
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> DEVOLVER</button>` : ''}
                                        <button class="btn-recibo-item" onclick="mostrarReciboDesdeBusqueda(${JSON.stringify(a).replace(/"/g, '&quot;')})">
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg> RECIBO</button>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>`;
            }).join('');
        }
    };

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
// MODAL DE DEVOLUCIÓN (FONDO BLOQUEADO)
// ========================================

window.iniciarDevolucionCliente = function(fila, nombre, disfraz, gDin, gObj) {
    registroSeleccionado = { fila, nombre, disfraz, gDin, gObj };
    document.getElementById('info-devolucion-cliente').innerHTML = `<strong>${nombre}</strong><br>${disfraz}`;
    document.getElementById('garantia-devolver-texto-cliente').innerHTML = `${(gDin && gDin > 0 ? 'Bs. ' + gDin : '')} ${gObj ? '- ' + gObj : ''}` || 'Sin garantía';
    
    const modal = document.getElementById('modal-devolucion-cliente');
    if (modal) {
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden'; 
    }
};

function configurarModalDevolucion() {
    document.getElementById('btn-cancelar-devolucion-cliente')?.addEventListener('click', () => {
        document.getElementById('modal-devolucion-cliente').style.display = 'none';
        document.body.style.overflow = ''; 
        registroSeleccionado = null;
    });

    document.getElementById('btn-confirmar-devolucion-cliente')?.addEventListener('click', async () => {
        if (!registroSeleccionado) return;
        const btn = document.getElementById('btn-confirmar-devolucion-cliente');
        btn.disabled = true;
        btn.innerHTML = 'Procesando...';

        try {
            await fetch(APPS_SCRIPT_URL, {
                method: 'POST',
                body: JSON.stringify({
                    accion: 'devolucion',
                    fila: registroSeleccionado.fila,
                    condiciones: document.getElementById('condiciones-devolucion-cliente')?.value || '',
                    notas: document.getElementById('notas-devolucion-cliente')?.value || ''
                })
            });

            alert('✅ Devolución registrada con éxito');
            document.getElementById('modal-devolucion-cliente').style.display = 'none';
            document.body.style.overflow = '';
            cargarDatosAutomaticamente(); 
            
        } catch (e) {
            alert('Error al registrar devolución: ' + e.message);
        }

        btn.disabled = false;
        btn.innerHTML = 'Confirmar Devolución';
        registroSeleccionado = null;
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
    return `DF${p.year}${p.month}${p.day}-${p.hour}${p.minute}${p.second}`;
}

window.mostrarReciboDesdeBusqueda = function(a) {
    mostrarRecibo({
        nombre: a.Nombre, cedula: a.Cedula, celular: a.Celular, disfraz: a.Disfraz,
        precio: a.PrecioAlquiler, fechaAlq: a.FechaAlquiler, fechaDev: a.FechaDevolucion,
        condiciones: a.Condiciones, garantiaDin: a.GarantiaDinero, garantiaObj: a.GarantiaObjeto,
        recibo: a.NumeroRecibo
    }, false);
};

window.mostrarRecibo = function(d, esVistaPrevia) {
    if (!d) return;
    
    const f = new Date();
    const fechaFooter = new Intl.DateTimeFormat('es-BO', { timeZone: 'America/La_Paz', year: 'numeric', month: '2-digit', day: '2-digit' }).format(f);
    const horaFooter = new Intl.DateTimeFormat('es-BO', { timeZone: 'America/La_Paz', hour: '2-digit', minute: '2-digit', hour12: false }).format(f);

    const cont = document.getElementById('recibo-contenido');
    if (!cont) return;

    cont.innerHTML = `
        <div class="recibo-header"><div class="recibo-brand">DISFRACES FANTASÍA</div><div class="recibo-sub">Ayacucho, Oruro - 76133121</div></div>
        ${esVistaPrevia ? '<div class="recibo-numero" style="color:#ff6b6b;">VISTA PREVIA</div>' : `<div class="recibo-numero">N° ${d.recibo || 'NUEVO'}</div>`}
        <div class="recibo-cliente"><div class="cliente-nombre">${d.nombre || '-'}</div><div class="cliente-dato">CI: ${d.cedula || '-'} - Cel: ${d.celular || '-'}</div></div>
        <div class="recibo-disfraz"><div class="disfraz-nombre">${d.disfraz || '-'}</div></div>
        <div class="recibo-fechas">
            <div class="fecha-item"><div class="fecha-label">Alquiler</div><div class="fecha-valor">${formatearFecha(d.fechaAlq)}</div></div>
            <div class="fecha-item"><div class="fecha-label">Devolución</div><div class="fecha-valor">${formatearFecha(d.fechaDev)}</div></div>
        </div>
        <div class="recibo-garantia"><div class="garantia-label">Garantía</div><div class="garantia-valor">Bs. ${d.garantiaDin || '0'} ${d.garantiaObj ? '+ '+d.garantiaObj : ''}</div></div>
        <div class="recibo-total"><div class="total-label">ALQUILER</div><div class="total-monto">Bs. ${d.precio || '0'}</div></div>
        <div class="recibo-firma"><div class="firma-linea"></div><div class="firma-texto">Firma del Cliente</div></div>
        <div class="recibo-condiciones">Me comprometo a devolver el disfraz en la fecha acordada.</div>
        <div class="recibo-footer"><div class="footer-gracias">GRACIAS POR SU PREFERENCIA</div><div class="footer-fecha">${fechaFooter} - ${horaFooter}</div></div>
    `;
    document.getElementById('modal-recibo').style.display = 'flex';
};

function configurarEventosRecibo() {
    document.getElementById('btn-vista-previa')?.addEventListener('click', () => {
        mostrarRecibo({
            nombre: document.getElementById('nombre').value.toUpperCase(),
            cedula: document.getElementById('cedula').value.toUpperCase(),
            celular: document.getElementById('celular').value,
            disfraz: document.getElementById('disfraz').value.toUpperCase(),
            precio: document.getElementById('precio').value || '0',
            fechaAlq: document.getElementById('fecha-alquiler').value,
            fechaDev: document.getElementById('fecha-devolucion').value,
            garantiaDin: document.getElementById('garantia-dinero').value || '0',
            garantiaObj: document.getElementById('garantia-objeto').value.toUpperCase()
        }, true);
    });

    document.getElementById('btn-imprimir-recibo')?.addEventListener('click', () => mostrarRecibo(ultimoRegistro, false));
    document.getElementById('btn-print-recibo')?.addEventListener('click', () => window.print());
    document.getElementById('btn-cerrar-recibo')?.addEventListener('click', () => document.getElementById('modal-recibo').style.display = 'none');
}

// ========================================
// TABLA DE HISTORIAL CON FECHA Y HORA
// ========================================

function mostrarHistorial(registros) {
    const tabla = document.getElementById('tabla-historial');
    if (!tabla || !registros.length) return;
    const filtro = document.getElementById('filtro-estado')?.value || 'todos';
    let filtrados = filtro === 'todos' ? registros : registros.filter(r => r.Estado === filtro);
    
    filtrados.sort((a, b) => b.fila - a.fila);

    tabla.innerHTML = `<table class="tabla-registros">
        <thead><tr><th>Fecha / Hora</th><th>Nombre</th><th>CI</th><th>Disfraz</th><th>Precio</th><th>Garantía</th><th>Estado</th></tr></thead>
        <tbody>${filtrados.map(r => `<tr>
            <td style="font-size: 0.75rem; color: #666; white-space: nowrap;">${r.FechaRegistro || formatearFecha(r.FechaAlquiler)}</td>
            <td><strong>${r.Nombre}</strong></td>
            <td>${r.Cedula}</td>
            <td>${r.Disfraz}</td>
            <td>Bs. ${r.PrecioAlquiler}</td>
            <td>Bs. ${r.GarantiaDinero} ${r.GarantiaObjeto}</td>
            <td><span class="resultado-estado ${r.Estado==='Alquilado'?'estado-alquilado':'estado-devuelto'}">${r.Estado}</span></td>
        </tr>`).join('')}</tbody></table>`;
}

function mostrarClientes(registros) {
    const tabla = document.getElementById('tabla-clientes');
    if (!tabla || !registros.length) return;
    const clientes = {};
    registros.forEach(r => {
        const ci = r.Cedula || 'S-CI';
        if (!clientes[ci]) clientes[ci] = { n: r.Nombre, ci: ci, cel: r.Celular, total: 0, ult: r.FechaAlquiler };
        clientes[ci].total++;
        if (new Date(r.FechaAlquiler) > new Date(clientes[ci].ult)) clientes[ci].ult = r.FechaAlquiler;
    });
    const lista = Object.values(clientes).sort((a, b) => b.total - a.total);

    tabla.innerHTML = `<table class="tabla-registros">
        <thead><tr><th>Nombre</th><th>CI</th><th>Celular</th><th>Alquileres</th><th>Último</th></tr></thead>
        <tbody>${lista.map(c => `<tr>
            <td>${c.n}</td><td>${c.ci}</td><td>${c.cel||'-'}</td>
            <td><strong style="color:var(--primary);">${c.total}</strong></td><td>${formatearFecha(c.ult)}</td>
        </tr>`).join('')}</tbody></table>`;
}

function configurarTabs() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn, .tab-content').forEach(el => el.classList.remove('active'));
            btn.classList.add('active');
            const tabId = 'tab-' + btn.dataset.tab;
            if (document.getElementById(tabId)) document.getElementById(tabId).classList.add('active');
            if (datosCargados) actualizarVistasSecundarias();
        });
    });
}

function configurarFechas() {
    const formatter = new Intl.DateTimeFormat('en-GB', { timeZone: 'America/La_Paz', year: 'numeric', month: '2-digit', day: '2-digit' });
    const hoy = new Date();
    const p1 = formatter.format(hoy).split('/');
    const hoyBolivia = `${p1[2]}-${p1[1]}-${p1[0]}`; 
    
    const dev = new Date();
    dev.setDate(hoy.getDate() + 3);
    const p2 = formatter.format(dev).split('/');
    const devBolivia = `${p2[2]}-${p2[1]}-${p2[0]}`;

    if (document.getElementById('fecha-alquiler')) document.getElementById('fecha-alquiler').value = hoyBolivia;
    if (document.getElementById('fecha-devolucion')) document.getElementById('fecha-devolucion').value = devBolivia;
}

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
        .catch(e => {
            if (statusEl) statusEl.className = 'status error';
            if (statusText) statusText.textContent = 'Sin Conexión';
        });
}

function calcularStats(registros) {
    if (!registros || !registros.length) return;

    const d = new Date();
    const formatter = new Intl.DateTimeFormat('en-GB', { 
        timeZone: 'America/La_Paz', 
        year: 'numeric', 
        month: '2-digit', 
        day: '2-digit' 
    });
    
    const partes = formatter.format(d).split('/'); 
    const hoyBolivia = `${partes[2]}-${partes[1]}-${partes[0]}`; 

    let hoyCount = 0;
    let pendientesCount = 0;
    let devueltosCount = 0;

    registros.forEach(r => {
        const estado = (r.Estado || '').toString().trim().toLowerCase();
        if (estado === 'alquilado') {
            pendientesCount++;
        } else if (estado === 'devuelto') {
            devueltosCount++;
        }

        const fechaAlquilerDB = (r.FechaAlquiler || '').toString().split('T')[0];
        
        if (fechaAlquilerDB === hoyBolivia) {
            hoyCount++;
        }
    });

    const statHoy = document.getElementById('stat-hoy');
    const statPend = document.getElementById('stat-pendientes');
    const statDev = document.getElementById('stat-devueltos');

    if (statHoy) statHoy.textContent = hoyCount;
    if (statPend) statPend.textContent = pendientesCount;
    if (statDev) statDev.textContent = devueltosCount;
}