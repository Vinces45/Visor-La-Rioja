import csv
import json
import re

def parse_codines(val, titulo):
    if not val or not val.strip():
        if "Navarrete" in titulo:
            return [26105]
        return []
    s = val.strip()
    codes_5 = [int(x) for x in re.findall(r'26\d{3}', s)]
    if codes_5:
        if s == '26161,261' and 26100 not in codes_5:
            codes_5.append(26100)
        return codes_5
    if s in ('26', '26.0'):
        return [26]
    return []

def clean_text(val):
    if not val:
        return ""
    return val.replace('\x0b\x0b', '   ').replace('\x0b', ' ').replace('\xa0', ' ').strip()

# Correcciones de estilo académico para las 3 descripciones en primera persona
CORRECCIONES_DESC = {
    "Historia de Entrena.": (
        "Se aborda el contexto geográfico (físico y humano), así como el arte, la religiosidad y la cultura popular de la localidad, "
        "junto con un recorrido por sus diferentes etapas históricas. Para el ámbito arqueológico e histórico medieval destacan el capítulo "
        "dedicado a la Edad Antigua —que recoge referencias a yacimientos tardoantiguos— y el capítulo centrado en la Entrena medieval "
        "(su génesis entre los siglos VIII y X, su fuero y su papel fronterizo entre los reinos de Castilla y Navarra)."
    ),
    "El lenguaje de las piedras.": (
        "Estudio arqueológico de la iglesia de Santo Tomás Apóstol de Haro, que incluye el análisis constructivo e histórico del primer "
        "templo medieval, cuya vigencia se extiende desde finales del siglo XIV hasta finales del siglo XV."
    ),
    "Ocón en la encrucijada. Estudio de un municipio riojano.": (
        "Estudio multidisciplinar sobre la evolución histórica, demográfica y ambiental del municipio de Ocón. Destacan los apartados "
        "dedicados al tránsito de la Antigüedad al Medievo y a la Edad Media (incluyendo el fuero de Ocón), así como el análisis del "
        "patrimonio histórico-artístico y arqueológico del término municipal: su castillo, yacimientos de época romana, ermitas e iglesias."
    )
}

articles = []

with open('Artículos_Purgados.csv', mode='r', encoding='utf-8') as f:
    reader = csv.reader(f)
    for row in reader:
        if not row or len(row) < 16:
            continue
        
        titulo = clean_text(row[15])
        codines = parse_codines(row[5], titulo)
        
        # Año de publicación (corrigiendo el caso 20122013 -> 2013)
        fecha_raw = row[4].strip()
        fecha = int(float(fecha_raw)) if fecha_raw else None
        if fecha == 20122013:
            fecha = 2013
        
        revista = clean_text(row[12]) if row[12].strip() else clean_text(row[7])
        descripcion = CORRECCIONES_DESC.get(titulo, clean_text(row[2]))
        
        articles.append({
            "codines": codines,
            "autor": clean_text(row[0]),
            "titulo": titulo,
            "revista": revista,
            "fecha": fecha,
            "epoca": clean_text(row[3]),
            "tipo_yacimiento": clean_text(row[14]),
            "yacimiento": clean_text(row[8]),
            "descripcion": descripcion
        })

with open('articles_clean.json', mode='w', encoding='utf-8') as out:
    json.dump(articles, out, ensure_ascii=False, indent=2)

print(f"¡Perfecto! Exportados {len(articles)} artículos revisados y corregidos.")