"""
CDS6324 Data Visualization
Preprocessing Script (Final Version)

Dataset:
Life Expectancy & Socio-Economic Indicators (World Bank)

Structure:
PART 1 — Base preprocessing (examiner-safe, visualization-focused)
PART 2 — Advanced preprocessing (exploratory analysis)

Important:
- Base datasets preserve missing values (except critical fields)
- Advanced datasets are clearly labeled and NOT replacements
"""

import pandas as pd
from pathlib import Path

# =========================================================
# CONFIGURATION
# =========================================================

RAW_DATA_PATH = Path("dataset/life expectancy.csv")
OUTPUT_DIR = Path("dataset/")

START_YEAR = 2000
END_YEAR = 2020

# =========================================================
# LOAD DATA
# =========================================================

def load_data(path: Path) -> pd.DataFrame:
    print("Loading raw dataset...")
    df = pd.read_csv(path)
    print(f"Loaded {df.shape[0]} rows × {df.shape[1]} columns")
    return df

# =========================================================
# STANDARDIZATION
# =========================================================

def standardize_columns(df: pd.DataFrame) -> pd.DataFrame:
    return df.rename(columns={
        "Country Name": "country",
        "Country Code": "country_code",
        "Region": "region",
        "IncomeGroup": "income_group",
        "Year": "year",
        "Life Expectancy World Bank": "life_expectancy",
        "Prevelance of Undernourishment": "undernourishment",
        "CO2": "co2",
        "Health Expenditure %": "health_exp_pct",
        "Education Expenditure %": "education_exp_pct",
        "Unemployment": "unemployment",
        "Corruption": "corruption",
        "Sanitation": "sanitation",
        "Injuries": "injuries",
        "Communicable": "communicable",
        "NonCommunicable": "non_communicable"
    })

# =========================================================
# TYPE CONVERSION
# =========================================================

def convert_types(df: pd.DataFrame) -> pd.DataFrame:
    df["year"] = df["year"].astype(int)

    numeric_cols = [
        "life_expectancy", "undernourishment", "co2",
        "health_exp_pct", "education_exp_pct", "unemployment",
        "corruption", "sanitation",
        "injuries", "communicable", "non_communicable"
    ]

    df[numeric_cols] = df[numeric_cols].apply(
        pd.to_numeric, errors="coerce"
    )

    return df

# =========================================================
# BASE MISSING VALUE HANDLING
# =========================================================

def drop_critical_missing(df: pd.DataFrame) -> pd.DataFrame:
    """
    Drop rows missing core analytical dimensions.
    Other missing values are intentionally preserved.
    """
    before = len(df)

    df = df.dropna(subset=[
        "life_expectancy",
        "region",
        "income_group"
    ])

    after = len(df)
    print(f"Dropped {before - after} rows with missing critical fields")
    return df

# =========================================================
# YEAR FILTERING
# =========================================================

def filter_years(df: pd.DataFrame) -> pd.DataFrame:
    df = df[(df["year"] >= START_YEAR) & (df["year"] <= END_YEAR)]
    print(f"Filtered data to years {START_YEAR}–{END_YEAR}")
    return df

# =========================================================
# BASE AGGREGATIONS (FOR DASHBOARD)
# =========================================================

def aggregate_region_year(df: pd.DataFrame) -> pd.DataFrame:
    return (
        df.groupby(["region", "year"])
          .mean(numeric_only=True)
          .reset_index()
    )

def aggregate_income_year(df: pd.DataFrame) -> pd.DataFrame:
    return (
        df.groupby(["income_group", "year"])
          .mean(numeric_only=True)
          .reset_index()
    )

# =========================================================
# ================= PART 2 ================================
# ADVANCED PREPROCESSING
# =========================================================

def missing_value_report(df: pd.DataFrame) -> pd.DataFrame:
    """Generate missing value diagnostics"""
    report = (
        df.isna().mean()
          .sort_values(ascending=False)
          .reset_index()
    )
    report.columns = ["variable", "missing_ratio"]
    return report

def interpolate_within_country(df: pd.DataFrame) -> pd.DataFrame:
    """
    Time-aware interpolation for life expectancy.
    Applied ONLY within the same country.
    Index-safe version using transform().
    """
    df = df.sort_values(["country", "year"])

    interpolated = (
        df.groupby("country")["life_expectancy"]
        .transform(
            lambda x: x.interpolate(limit_direction="both")
            if x.notna().sum() > 1 else x
        )
    )

    df["life_expectancy_interp"] = interpolated
    df["life_expectancy_was_interpolated"] = (
        df["life_expectancy"].isna() & interpolated.notna()
    )

    return df

def detect_outliers_iqr(df: pd.DataFrame, column: str) -> pd.DataFrame:
    """Flag outliers using IQR (no removal)"""
    q1 = df[column].quantile(0.25)
    q3 = df[column].quantile(0.75)
    iqr = q3 - q1

    df[f"{column}_is_outlier"] = (
        (df[column] < q1 - 1.5 * iqr) |
        (df[column] > q3 + 1.5 * iqr)
    )

    return df

def derive_health_indicators(df: pd.DataFrame) -> pd.DataFrame:
    """Create derived sustainability & health indicators"""
    df["disease_burden_ratio"] = (
        df["non_communicable"] /
        (df["communicable"] + 1)
    )
    return df

def rolling_life_expectancy(df: pd.DataFrame) -> pd.DataFrame:
    """5-year rolling average of life expectancy"""
    df = df.sort_values(["country", "year"])

    df["life_expectancy_5yr_avg"] = (
        df.groupby("country")["life_expectancy"]
          .rolling(window=5, min_periods=1)
          .mean()
          .reset_index(level=0, drop=True)
    )

    return df

# =========================================================
# EXPORT
# =========================================================

def export_readme():
    """Save README describing processed datasets"""
    readme_text = """
Processed Datasets Description
==============================

1. life_expectancy_clean.csv
   - Base dataset for visualization
   - Country-level World Bank indicators
   - Missing values preserved (except critical fields)

2. region_year_summary.csv
   - Yearly averages aggregated by region

3. income_year_summary.csv
   - Yearly averages aggregated by income group

4. life_expectancy_advanced.csv
   - Exploratory dataset with derived features
   - Includes interpolation flags, rolling averages,
     CO2 outlier flags, and disease burden ratio
   - NOT a replacement for base dataset

5. missing_value_report.csv
   - Missing value proportions per variable
"""

    with open(OUTPUT_DIR / "README.txt", "w", encoding="utf-8") as f:
        f.write(readme_text.strip())

    print("README.txt saved")

def export_all(
    df_base,
    df_region,
    df_income,
    df_advanced,
    missing_report_df
):
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    df_base.to_csv(OUTPUT_DIR / "life_expectancy_clean.csv", index=False)
    df_region.to_csv(OUTPUT_DIR / "region_year_summary.csv", index=False)
    df_income.to_csv(OUTPUT_DIR / "income_year_summary.csv", index=False)
    df_advanced.to_csv(OUTPUT_DIR / "life_expectancy_advanced.csv", index=False)
    missing_report_df.to_csv(OUTPUT_DIR / "missing_value_report.csv", index=False)

    export_readme()
    print("All datasets exported successfully")

# =========================================================
# MAIN PIPELINE
# =========================================================

def main():
    # ---------- Base preprocessing ----------
    df = load_data(RAW_DATA_PATH)
    df = standardize_columns(df)
    df = convert_types(df)
    df = drop_critical_missing(df)
    df = filter_years(df)

    # ---------- Validation checks ----------
    assert df["year"].between(START_YEAR, END_YEAR).all(), \
        "Year filtering failed"

    assert df["life_expectancy"].notna().all(), \
        "Life expectancy contains missing values after cleaning"

    df_region = aggregate_region_year(df)
    df_income = aggregate_income_year(df)

    # ---------- Advanced preprocessing ----------
    missing_report_df = missing_value_report(df)

    df_adv = df.copy()
    df_adv = interpolate_within_country(df_adv)
    df_adv = detect_outliers_iqr(df_adv, "co2")
    df_adv = derive_health_indicators(df_adv)
    df_adv = rolling_life_expectancy(df_adv)

    # ---------- Export ----------
    export_all(
        df,
        df_region,
        df_income,
        df_adv,
        missing_report_df
    )

    print("Complete preprocessing pipeline finished.")

if __name__ == "__main__":
    main()
