"""
Extracao generica de tabelas de composicao quimica do MAEN0006.pdf usando pdfplumber.

Para cada secao definida em SECTIONS, le o intervalo de paginas (1-indexed, numeracao do PDF),
detecta o cabecalho de colunas combinando as duas primeiras linhas da tabela
(linha 0: Standard Designation / Grade.../ Steel Number / UNS Number / "Weight %...";
 linha 1: C, Mn, Si, P, S, Cr, Ni, Mo, [extras], Others),
ignora cabecalhos repetidos em paginas "(Continued)", preenche para baixo a coluna
"Standard Designation" quando vazia (linha de continuacao da mesma norma), e grava um CSV.
"""
import csv
import sys
import pdfplumber

PDF = "MAEN0006.pdf"

# (section_label, pagina_pdf_inicio, pagina_pdf_fim, arquivo_saida)  -- paginas 1-indexed, inclusive
SECTIONS = [
    ("2.1 Chemical Composition of Carbon Steels for General Use", 38, 48, "extracted/cap2_2.1_carbon_steels_general.csv"),
    ("2.2 Chemical Composition of High Manganese Carbon Steels for General Use", 49, 49, "extracted/cap2_2.2_high_manganese_carbon_steels.csv"),
    ("2.3.1 Chromium (Cr) Steels", 50, 51, "extracted/cap2_2.3.1_cr_steels.csv"),
    ("2.3.2 Chromium-Molybdenum (Cr-Mo) Steels", 52, 52, "extracted/cap2_2.3.2_cr_mo_steels.csv"),
    ("2.3.3 Chromium-Nickel (Cr-Ni) Steels", 53, 53, "extracted/cap2_2.3.3_cr_ni_steels.csv"),
    ("2.3.4 Nickel-Chromium-Molybdenum (Ni-Cr-Mo) Steels", 54, 54, "extracted/cap2_2.3.4_ni_cr_mo_steels.csv"),
    ("2.3.5 Chromium-Molybdenum-Aluminum (Cr-Mo-Al) Steels", 55, 55, "extracted/cap2_2.3.5_cr_mo_al_steels.csv"),
    ("2.3.6 Boron (B) Steels", 56, 56, "extracted/cap2_2.3.6_boron_steels.csv"),
    ("2.3.7 Chromium-Vanadium (Cr-V) Steels", 57, 57, "extracted/cap2_2.3.7_cr_v_steels.csv"),

    ("3.1B Chemical Composition of Carbon Steels for Structural Steel Plates", 80, 88, "extracted/cap3_3.1B_carbon_steel_plates.csv"),
    ("3.2.1B Chemical Composition of High-Strength Low-Alloy Structural Steel Plates", 89, 97, "extracted/cap3_3.2.1B_hsla_plates.csv"),
    ("3.2.2B Chemical Composition of Alloy Steels for Structural Steel Plates", 98, 107, "extracted/cap3_3.2.2B_alloy_steel_plates.csv"),
    ("3.3B Chemical Composition of Structural Steels with Improved Atmospheric Corrosion-Resistance", 108, 110, "extracted/cap3_3.3B_corrosion_resistant_plates.csv"),

    ("4.1B Chemical Composition of Carbon Steel Pressure Vessel Plates", 123, 128, "extracted/cap4_4.1B_carbon_steel_pv_plates.csv"),
    ("4.2B Chemical Composition of Carbon Steels for Pressure Vessel Plates - Impact Tested Below -20C", 129, 130, "extracted/cap4_4.2B_carbon_steel_pv_plates_low_temp.csv"),
    ("4.3A Chemical Composition of 1/2 Mo Alloy Steels for Pressure Vessel Plates", 131, 134, "extracted/cap4_4.3A_half_mo_alloy_pv_plates.csv"),
    ("4.4.1A Chemical Composition of 1/2Cr-1/2Mo Alloy Steels for Pressure Vessel Plates", 135, 135, "extracted/cap4_4.4.1A_half_cr_half_mo_pv_plates.csv"),
    ("4.4.2A Chemical Composition of 1Cr-1/2Mo Alloy Steels for Pressure Vessel Plates", 136, 136, "extracted/cap4_4.4.2A_1cr_half_mo_pv_plates.csv"),
    ("4.4.3A Chemical Composition of 1.25Cr-1/2Mo Alloy Steels for Pressure Vessel Plates", 137, 137, "extracted/cap4_4.4.3A_1_25cr_half_mo_pv_plates.csv"),
    ("4.4.4A Chemical Composition of 2.25Cr-1Mo Alloy Steels for Pressure Vessel Plates", 138, 139, "extracted/cap4_4.4.4A_2_25cr_1mo_pv_plates.csv"),
    ("4.4.5A Chemical Composition of 3Cr-1Mo Alloy Steels for Pressure Vessel Plates", 140, 140, "extracted/cap4_4.4.5A_3cr_1mo_pv_plates.csv"),
    ("4.4.6A Chemical Composition of 5Cr-1/2Mo Alloy Steels for Pressure Vessel Plates", 141, 141, "extracted/cap4_4.4.6A_5cr_half_mo_pv_plates.csv"),
    ("4.4.7A Chemical Composition of 9Cr-1Mo Alloy Steels for Pressure Vessel Plates", 142, 142, "extracted/cap4_4.4.7A_9cr_1mo_pv_plates.csv"),
    ("4.5.1A Chemical Composition of 1/2Ni Alloy Steels for Pressure Vessel Plates", 143, 143, "extracted/cap4_4.5.1A_half_ni_pv_plates.csv"),
    ("4.5.2A Chemical Composition of 1.25Ni Alloy Steels for Pressure Vessel Plates", 144, 144, "extracted/cap4_4.5.2A_1_25ni_pv_plates.csv"),
    ("4.5.3A Chemical Composition of 2.25Ni Alloy Steels for Pressure Vessel Plates", 145, 145, "extracted/cap4_4.5.3A_2_25ni_pv_plates.csv"),
    ("4.5.4A Chemical Composition of 3.5Ni Alloy Steels for Pressure Vessel Plates", 146, 147, "extracted/cap4_4.5.4A_3_5ni_pv_plates.csv"),
    ("4.5.5A Chemical Composition of 5Ni Alloy Steels for Pressure Vessel Plates", 148, 148, "extracted/cap4_4.5.5A_5ni_pv_plates.csv"),
    ("4.5.6A Chemical Composition of 9Ni Alloy Steels for Pressure Vessel Plates", 149, 150, "extracted/cap4_4.5.6A_9ni_pv_plates.csv"),
    ("4.6.1A Chemical Composition of 1/4Ni-1/8Mo Alloy Steels for Pressure Vessel Plates", 151, 152, "extracted/cap4_4.6.1A_quarter_ni_eighth_mo_pv_plates.csv"),
    ("4.6.2A Chemical Composition of 3/4Ni-1/2Mo Alloy Steels for Pressure Vessel Plates", 153, 154, "extracted/cap4_4.6.2A_three_quarter_ni_half_mo_pv_plates.csv"),
    ("4.7A Chemical Composition of Ferritic and Martensitic Stainless Steels for Pressure Vessel Plates", 155, 156, "extracted/cap4_4.7A_ferritic_martensitic_ss_pv_plates.csv"),
    ("4.8A Chemical Composition of Austenitic Stainless Steels for Pressure Vessel Plates", 157, 164, "extracted/cap4_4.8A_austenitic_ss_pv_plates.csv"),
    ("4.9A Chemical Composition of Duplex (Ferritic-Austenitic) Stainless Steels for Pressure Vessel Plates", 165, 166, "extracted/cap4_4.9A_duplex_ss_pv_plates.csv"),

    ("5.1B Chemical Composition of Carbon Steel Tubes for General and Structural Applications", 190, 198, "extracted/cap5_5.1B_carbon_steel_tubes_general.csv"),
    ("5.2A Chemical Composition of Alloy Steel Tubes for General and Structural Applications", 199, 201, "extracted/cap5_5.2A_alloy_steel_tubes_general.csv"),
    ("5.3.1A Chemical Composition of Ferritic and Martensitic Stainless Steel Tubes for General and Structural Applications", 202, 203, "extracted/cap5_5.3.1A_ferritic_martensitic_ss_tubes_general.csv"),
    ("5.3.2A Chemical Composition of Austenitic Stainless Steel Tubes for General and Structural Applications", 204, 211, "extracted/cap5_5.3.2A_austenitic_ss_tubes_general.csv"),
    ("5.4B Chemical Composition of Carbon Steel Tubes and Pipes - Impact Tested Below -20C", 212, 212, "extracted/cap5_5.4B_carbon_steel_tubes_low_temp.csv"),
    ("5.5A Chemical Composition of Alloy Steel Tubes and Pipes for Low-Temperature Service", 213, 217, "extracted/cap5_5.5A_alloy_steel_tubes_low_temp.csv"),
    ("5.6B Chemical Composition of Carbon Steel Tubes and Pipes for Pressure Purposes", 218, 223, "extracted/cap5_5.6B_carbon_steel_tubes_pressure.csv"),
    ("5.7B Chemical Composition of Carbon Steel Tubes and Pipes for Pressure Purposes at High Temperatures", 224, 226, "extracted/cap5_5.7B_carbon_steel_tubes_pressure_high_temp.csv"),
    ("5.8.1A Chemical Composition of 1/2Mo Alloy Steel Tubes and Pipes for Pressure Purposes at High Temperatures", 227, 227, "extracted/cap5_5.8.1A_half_mo_tubes_high_temp.csv"),
    ("5.8.2A Chemical Composition of 3/4Mo Alloy Steel Tubes and Pipes for Pressure Purposes at High Temperatures", 228, 229, "extracted/cap5_5.8.2A_three_quarter_mo_tubes_high_temp.csv"),
    ("5.8.3A Chemical Composition of 1/2Cr-1/2Mo Alloy Steel Tubes and Pipes for Pressure Purposes at High Temperatures", 230, 230, "extracted/cap5_5.8.3A_half_cr_half_mo_tubes_high_temp.csv"),
    ("5.8.4A Chemical Composition of 1Cr-1/2Mo Alloy Steel Tubes and Pipes for Pressure Purposes at High Temperatures", 231, 232, "extracted/cap5_5.8.4A_1cr_half_mo_tubes_high_temp.csv"),
    ("5.8.5A Chemical Composition of 1.25Cr-1/2Mo Alloy Steel Tubes and Pipes for Pressure Purposes at High Temperatures", 233, 233, "extracted/cap5_5.8.5A_1_25cr_half_mo_tubes_high_temp.csv"),
    ("5.8.6A Chemical Composition of 2.25Cr-1Mo Alloy Steel Tubes and Pipes for Pressure Purposes at High Temperatures", 234, 234, "extracted/cap5_5.8.6A_2_25cr_1mo_tubes_high_temp.csv"),
    ("5.8.7A Chemical Composition of 5Cr-1/2Mo Alloy Steel Tubes and Pipes for Pressure Purposes at High Temperatures", 235, 235, "extracted/cap5_5.8.7A_5cr_half_mo_tubes_high_temp.csv"),
    ("5.8.8A Chemical Composition of 9Cr-1Mo Alloy Steel Tubes and Pipes for Pressure Purposes at High Temperatures", 236, 236, "extracted/cap5_5.8.8A_9cr_1mo_tubes_high_temp.csv"),
    ("5.9.1A Chemical Composition of Ferritic and Martensitic Stainless Steel Tubes and Pipes for Pressure Purposes and High Temperatures", 237, 238, "extracted/cap5_5.9.1A_ferritic_martensitic_ss_tubes_high_temp.csv"),
    ("5.9.2A Chemical Composition of Austenitic Stainless Steel Tubes and Pipes for Pressure Purposes and High Temperatures", 239, 260, "extracted/cap5_5.9.2A_austenitic_ss_tubes_high_temp.csv"),
    ("5.10.1B Chemical Composition of Line Pipe Steels Without Notch Toughness Requirements", 261, 266, "extracted/cap5_5.10.1B_line_pipe_no_notch.csv"),
    ("5.10.2B Chemical Composition of Line Pipe Steels With Notch Toughness Requirements", 267, 270, "extracted/cap5_5.10.2B_line_pipe_notch.csv"),

    ("6.1.1B Chemical Composition of Carbon Steel Forgings for General Use", 284, 287, "extracted/cap6_6.1.1B_carbon_steel_forgings_general.csv"),
    ("6.1.2B Chemical Composition of Carbon Steel Forgings for Piping, Pressure Vessel and Components", 288, 289, "extracted/cap6_6.1.2B_carbon_steel_forgings_piping.csv"),
    ("6.2.1A Chemical Composition of 1.25Cr-0.5Mo Alloy Steel Forgings for General Use", 290, 291, "extracted/cap6_6.2.1A_1_25cr_half_mo_forgings_general.csv"),
    ("6.2.2.1A Chemical Composition of Mo Alloy Steel Forgings for Piping, Pressure Vessel and Components", 292, 292, "extracted/cap6_6.2.2.1A_mo_forgings_piping.csv"),
    ("6.2.2.2A Chemical Composition of 1/2Cr-1/2Mo Alloy Steel Forgings for Piping, Pressure Vessel and Components", 293, 293, "extracted/cap6_6.2.2.2A_half_cr_half_mo_forgings_piping.csv"),
    ("6.2.2.3A Chemical Composition of 1Cr-1/2Mo Alloy Steel Forgings for Piping, Pressure Vessel and Components", 294, 294, "extracted/cap6_6.2.2.3A_1cr_half_mo_forgings_piping.csv"),
    ("6.2.2.4A Chemical Composition of 1.25Cr-1/2Mo Alloy Steel Forgings for Piping, Pressure Vessel and Components", 295, 295, "extracted/cap6_6.2.2.4A_1_25cr_half_mo_forgings_piping.csv"),
    ("6.2.2.5A Chemical Composition of 2.25Cr-1Mo Alloy Steel Forgings for Piping, Pressure Vessel and Components", 296, 297, "extracted/cap6_6.2.2.5A_2_25cr_1mo_forgings_piping.csv"),
    ("6.2.2.6A Chemical Composition of 3Cr-1Mo Alloy Steel Forgings for Piping, Pressure Vessel and Components", 298, 298, "extracted/cap6_6.2.2.6A_3cr_1mo_forgings_piping.csv"),
    ("6.2.2.7A Chemical Composition of 5Cr-1/2Mo Alloy Steel Forgings for Piping, Pressure Vessel and Components", 299, 299, "extracted/cap6_6.2.2.7A_5cr_half_mo_forgings_piping.csv"),
    ("6.2.2.8A Chemical Composition of 9Cr-1Mo Alloy Steel Forgings for Piping, Pressure Vessel and Components", 300, 300, "extracted/cap6_6.2.2.8A_9cr_1mo_forgings_piping.csv"),
    ("6.2.2.9A Chemical Composition of 11Cr-1/2Ni-1Mo Alloy Steel Forgings for Piping, Pressure Vessel and Components", 301, 301, "extracted/cap6_6.2.2.9A_11cr_half_ni_1mo_forgings_piping.csv"),
    ("6.2.2.10A Chemical Composition of Ni Alloy Steel Forgings for Piping, Pressure Vessel and Components", 302, 303, "extracted/cap6_6.2.2.10A_ni_forgings_piping.csv"),
    ("6.2.2.11A Chemical Composition of Ni-Mn Alloy Steel Forgings for Piping, Pressure Vessel and Components", 304, 304, "extracted/cap6_6.2.2.11A_ni_mn_forgings_piping.csv"),
    ("6.2.2.12A Chemical Composition of 3/4Ni-1/2Cr-Mo Alloy Steel Forgings for Piping, Pressure Vessel and Components", 305, 305, "extracted/cap6_6.2.2.12A_3_4ni_half_cr_mo_forgings_piping.csv"),
    ("6.2.2.13A Chemical Composition of 3/4Ni-1/2Mo Alloy Steel Forgings for Piping, Pressure Vessel and Components", 306, 306, "extracted/cap6_6.2.2.13A_3_4ni_half_mo_forgings_piping.csv"),
    ("6.2.2.14A Chemical Composition of 3.5Ni-1.75Cr-1/2Mo Alloy Steel Forgings for Piping, Pressure Vessel and Components", 307, 307, "extracted/cap6_6.2.2.14A_3_5ni_1_75cr_half_mo_forgings_piping.csv"),
    ("6.3.1A Chemical Composition of Martensitic Stainless Steel Forgings", 308, 309, "extracted/cap6_6.3.1A_martensitic_ss_forgings.csv"),
    ("6.3.2A Chemical Composition of Ferritic Stainless Steel Forgings", 310, 310, "extracted/cap6_6.3.2A_ferritic_ss_forgings.csv"),
    ("6.3.3A Chemical Composition of Austenitic Stainless Steel Forgings", 311, 319, "extracted/cap6_6.3.3A_austenitic_ss_forgings.csv"),
    ("6.3.4A Chemical Composition of Precipitation-Hardening Stainless Steel Forgings", 320, 321, "extracted/cap6_6.3.4A_ph_ss_forgings.csv"),
    ("6.3.5A Chemical Composition of Duplex (Ferritic-Austenitic) Stainless Steel Forgings", 322, 323, "extracted/cap6_6.3.5A_duplex_ss_forgings.csv"),

    ("7.1.1B Chemical Composition of Cast Carbon Steel for General and Structural Applications", 335, 337, "extracted/cap7_7.1.1B_cast_carbon_steel_general.csv"),
    ("7.1.2B Chemical Composition of Cast Carbon Steel for Pressure Purposes at High Temperatures", 338, 338, "extracted/cap7_7.1.2B_cast_carbon_steel_high_temp.csv"),
    ("7.1.3B Chemical Composition of Cast Carbon Steel for Pressure Purposes at Low Temperatures", 339, 339, "extracted/cap7_7.1.3B_cast_carbon_steel_low_temp.csv"),
    ("7.2A Chemical Composition of Cast Manganese Steels", 340, 341, "extracted/cap7_7.2A_cast_manganese_steels.csv"),
    ("7.3.1A Chemical Composition of Cast Alloy Steels for General and Structural Purposes", 342, 346, "extracted/cap7_7.3.1A_cast_alloy_steels_general.csv"),
    ("7.3.2A Chemical Composition of Cast Alloy Steels for Pressure Purposes at High Temperatures", 347, 348, "extracted/cap7_7.3.2A_cast_alloy_steels_high_temp.csv"),
    ("7.3.3A Chemical Composition of Cast Alloy Steels for Pressure Purposes at Low Temperatures", 349, 350, "extracted/cap7_7.3.3A_cast_alloy_steels_low_temp.csv"),
    ("7.4.1.1A Chemical Composition of Martensitic and Ferritic Stainless Steels for General and Corrosion Resistant Applications", 351, 352, "extracted/cap7_7.4.1.1A_cast_martensitic_ferritic_ss_general.csv"),
    ("7.4.1.2A Chemical Composition of Austenitic Stainless Steels for General and Corrosion Resistant Applications", 353, 358, "extracted/cap7_7.4.1.2A_cast_austenitic_ss_general.csv"),
    ("7.4.2.1A Chemical Composition of Martensitic and Ferritic Stainless Steels for Pressure Purposes", 359, 360, "extracted/cap7_7.4.2.1A_cast_martensitic_ferritic_ss_pressure.csv"),
    ("7.4.2.2A Chemical Composition of Austenitic Stainless Steels for Pressure Purposes", 361, 362, "extracted/cap7_7.4.2.2A_cast_austenitic_ss_pressure.csv"),
    ("7.5A Chemical Composition of Cast Heat Resistant Steels", 363, 370, "extracted/cap7_7.5A_cast_heat_resistant_steels.csv"),

    ("8.1.1A Chemical Composition of Martensitic Stainless Steels (Plate/Sheet/Strip)", 378, 379, "extracted/cap8_8.1.1A_wrought_martensitic_ss_plate.csv"),
    ("8.1.2A Chemical Composition of Ferritic Stainless Steels (Plate/Sheet/Strip)", 380, 383, "extracted/cap8_8.1.2A_wrought_ferritic_ss_plate.csv"),
    ("8.1.3A Chemical Composition of Austenitic Stainless Steels (Plate/Sheet/Strip)", 384, 398, "extracted/cap8_8.1.3A_wrought_austenitic_ss_plate.csv"),
    ("8.1.4A Chemical Composition of Precipitation-Hardening Stainless Steels (Plate/Sheet/Strip)", 399, 403, "extracted/cap8_8.1.4A_wrought_ph_ss_plate.csv"),
    ("8.1.5A Chemical Composition of Duplex (Ferritic-Austenitic) Stainless Steels (Plate/Sheet/Strip)", 404, 405, "extracted/cap8_8.1.5A_wrought_duplex_ss_plate.csv"),
    ("8.2.1A Chemical Composition of Martensitic Stainless Steels (Bar)", 406, 409, "extracted/cap8_8.2.1A_wrought_martensitic_ss_bar.csv"),
    ("8.2.2A Chemical Composition of Ferritic Stainless Steels (Bar)", 410, 411, "extracted/cap8_8.2.2A_wrought_ferritic_ss_bar.csv"),
    ("8.2.3A Chemical Composition of Austenitic Stainless Steels (Bar)", 412, 420, "extracted/cap8_8.2.3A_wrought_austenitic_ss_bar.csv"),
    ("8.2.4A Chemical Composition of Precipitation-Hardening Stainless Steels (Bar)", 421, 423, "extracted/cap8_8.2.4A_wrought_ph_ss_bar.csv"),
    ("8.2.5A Chemical Composition of Duplex Stainless Steels (Bar)", 424, 431, "extracted/cap8_8.2.5A_wrought_duplex_ss_bar.csv"),

    ("9.1.1 Chemical Composition of Resulfurized Carbon Steels for Free-Machining Applications", 432, 433, "extracted/cap9_9.1.1_resulfurized_carbon_free_machining.csv"),
    ("9.1.2 Chemical Composition of Rephosphorized and Resulfurized Carbon Steels for Free-Machining Applications", 434, 434, "extracted/cap9_9.1.2_rephos_resulfurized_carbon_free_machining.csv"),
    ("9.1.3 Chemical Composition of Resulfurized and Leaded Carbon Steels for Free-Machining Applications", 435, 435, "extracted/cap9_9.1.3_resulfurized_leaded_carbon_free_machining.csv"),
    ("9.1.4-9.1.5 Chemical Composition of Rephosphorized/Resulfurized/Leaded Carbon Steels and Free-Machining Stainless Steels", 436, 436, "extracted/cap9_9.1.4_9.1.5_rephos_resulfurized_leaded_and_ss_free_machining.csv"),
    ("9.2.1 Chemical Composition of Cold Rolled Carbon Spring Steels", 437, 438, "extracted/cap9_9.2.1_cold_rolled_carbon_spring_steels.csv"),
    ("9.2.2.1-9.2.2.6 Chemical Composition of Hot Rolled Alloy Spring Steels (Si/Cr/Cr-Si/Cr-Mo/Cr-V/Cr-B)", 439, 440, "extracted/cap9_9.2.2_hot_rolled_alloy_spring_steels.csv"),
    ("9.2.3 Chemical Composition of Stainless Spring Steels", 441, 441, "extracted/cap9_9.2.3_stainless_spring_steels.csv"),
    ("9.3.1 Chemical Composition of Carbon Tool Steels", 442, 442, "extracted/cap9_9.3.1_carbon_tool_steels.csv"),
    ("9.3.2.1-9.3.2.2 Chemical Composition of High Speed Tool Steels (Tungsten and Molybdenum Type)", 443, 444, "extracted/cap9_9.3.2_high_speed_tool_steels.csv"),
    ("9.3.3 Chemical Composition of Cold Work Tool Steels", 445, 445, "extracted/cap9_9.3.3_cold_work_tool_steels.csv"),
    ("9.3.4-9.3.5 Chemical Composition of Hot Work Tool Steels and Special Purpose Tool Steels", 446, 446, "extracted/cap9_9.3.4_9.3.5_hot_work_and_special_purpose_tool_steels.csv"),
    ("9.4.1 Chemical Composition of Bearing Steels", 447, 447, "extracted/cap9_9.4.1_bearing_steels.csv"),
]

DEFAULT_BASE_COLS = ["Standard Designation", "Grade/Class/Type/Symbol or Name", "Steel Number", "UNS Number"]


def clean(v):
    if v is None:
        return ""
    return " ".join(str(v).split())


def find_cmn_index(clean_row):
    """Retorna o indice da celula 'C' seguida por 'Mn', ou None se nao encontrado."""
    for j in range(len(clean_row) - 1):
        if clean_row[j] == "C" and clean_row[j + 1] == "Mn":
            return j
    return None


def extract_section(pdf, page_start, page_end):
    col_names = None
    rows = []
    last_designation = ""
    header_rows = []  # acumula linhas de cabecalho antes de achar C/Mn (so na 1a tabela)

    for page_idx in range(page_start - 1, page_end):
        page = pdf.pages[page_idx]
        for table in page.extract_tables():
            i = 0
            seen_cmn_row = False
            while i < len(table):
                row = table[i]
                clean_row = [clean(c) for c in row]

                elem_start = find_cmn_index(clean_row)
                if elem_start is not None:
                    seen_cmn_row = True
                    if col_names is None:
                        elem_cols = clean_row[elem_start:]
                        base_cols = []
                        for j in range(elem_start):
                            parts = [hr[j] for hr in header_rows + [clean_row] if j < len(hr) and hr[j]]
                            name = " ".join(dict.fromkeys(parts)) if parts else f"Field{j+1}"
                            base_cols.append(name)
                        col_names = base_cols + elem_cols
                    header_rows = []
                    i += 1
                    continue

                # Linhas antes da linha C/Mn fazem parte do bloco de cabecalho (pode se repetir em paginas "Continued")
                if not seen_cmn_row:
                    if col_names is None:
                        header_rows.append(clean_row)
                    i += 1
                    continue

                # Ignora linhas completamente vazias
                if not any(clean_row):
                    i += 1
                    continue

                # Ajusta tamanho da linha ao numero de colunas detectado
                if len(clean_row) < len(col_names):
                    clean_row += [""] * (len(col_names) - len(clean_row))
                elif len(clean_row) > len(col_names):
                    clean_row = clean_row[:len(col_names)]

                if clean_row[0]:
                    last_designation = clean_row[0]
                else:
                    clean_row[0] = last_designation

                rows.append(clean_row)
                i += 1

    return col_names, rows


def main():
    with pdfplumber.open(PDF) as pdf:
        for label, p_start, p_end, out_csv in SECTIONS:
            col_names, rows = extract_section(pdf, p_start, p_end)
            if col_names is None:
                print(f"[AVISO] Nenhum cabecalho detectado para '{label}' (paginas {p_start}-{p_end})")
                continue
            with open(out_csv, "w", newline="", encoding="utf-8-sig") as f:
                writer = csv.writer(f)
                writer.writerow(["Section"] + col_names)
                for r in rows:
                    writer.writerow([label] + r)
            print(f"{label}: {len(rows)} linhas -> {out_csv}")


if __name__ == "__main__":
    main()
