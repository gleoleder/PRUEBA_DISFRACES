# Disfraces Fantasía - Sistema Completo

Sistema de gestión de alquiler de disfraces conectado a Google Sheets vía Google Apps Script.

## 📁 Ubicación
`C:\Users\Jhon-\Desktop\disfracesfantasia-completo\`

## 🚀 Instalación

### 1. Configurar Google Apps Script

1. Ve a https://script.google.com/
2. Crea un nuevo proyecto
3. Copia y pega el código de `APPS_SCRIPT_CODE.txt`
4. Guarda (Ctrl+S)
5. **Implementar** → **Nueva implementación** → **Aplicación web**
6. Ejecutar como: **Yo**
7. Quién tiene acceso: **Cualquier persona**
8. Copia la URL que te da

### 2. Configurar el proyecto

1. Abre `config.js`
2. Reemplaza `PEGAR_AQUI_URL_DEL_APPS_SCRIPT` con tu URL
3. Guarda el archivo

### 3. Ejecutar

```bash
cd C:\Users\Jhon-\Desktop\disfracesfantasia-completo
python -m http.server 8002
```

Abre: http://localhost:8002

## ✨ Funcionalidades

- 📝 **Registrar alquileres** - Formulario completo con datos del cliente
- 🔍 **Buscar clientes** - Por nombre o cédula
- 📦 **Devoluciones** - Registrar devoluciones con estado del disfraz
- 📋 **Historial** - Ver todos los registros con filtros
- ⭐ **Clientes habituales** - Lista automática de clientes frecuentes
- 🖨️ **Recibos** - Generar e imprimir comprobantes
- 📊 **Estadísticas** - Alquileres hoy, pendientes y devueltos

## 🔧 Configuración Google Sheet

- **Sheet ID:** `1cHNX8O2BvQRkhr_P5cww5I8hwvQoknBQabLQnjjICLE`
- **Hoja:** `Alquileres` (se crea automáticamente)

## 📞 Contacto
Disfraces Fantasía - Oruro, Bolivia
Teléfono: 76133121
Ubicación: Calle Ayacucho
