# Visor Histórico de La Rioja

Visor web interactivo de la comunidad de La Rioja que permite explorar diferentes localidades y consultar artículos antiguos vinculados a cada municipio.

## 🚀 Demo
https://vinces45.github.io/Visor-La-Rioja/

## 🛠️ Tecnologías y Estructura
* **Frontend:** HTML5, CSS3, JavaScript (Vanilla).
* **Datos Espaciales:** Formato GeoJSON (`municipios.geojson`, `ccaa.geojson`) para la representación y delimitación del mapa.
* **Datos Documentales:** Formato JSON (`articles_clean.json`) para el almacenamiento y carga de los artículos históricos.
* **Lógica:** El archivo `app.js` se encarga de enlazar los datos del JSON con los polígonos del mapa para mostrar la información dinámicamente.

## 💻 Instalación y Uso
El proyecto es completamente estático. Para ejecutarlo en tu máquina local:
1. Clona este repositorio: `git clone https://github.com/Vinces45/Visor-La-Rioja.git`
2. Abre el archivo `index.html` en cualquier navegador web moderno.
*(Opcional: Se recomienda usar una extensión como Live Server en VSCode para evitar problemas de CORS al cargar los archivos locales JSON/GeoJSON).*
