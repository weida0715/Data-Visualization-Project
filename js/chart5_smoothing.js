/**
 * Chart 5 — Cumulative Life Expectancy (AUC)
 * Horizontal bar chart by income group using filtered records.
 */

const aucMargin = { top: 40, right: 80, bottom: 45, left: 180 };
const aucWidth = 900 - aucMargin.left - aucMargin.right;
const aucHeight = 420 - aucMargin.top - aucMargin.bottom;

const aucSvg = d3
  .select("#chart5")
  .append("svg")
  .attr("width", aucWidth + aucMargin.left + aucMargin.right)
  .attr("height", aucHeight + aucMargin.top + aucMargin.bottom)
  .attr(
    "viewBox",
    `0 0 ${aucWidth + aucMargin.left + aucMargin.right} ${
      aucHeight + aucMargin.top + aucMargin.bottom
    }`,
  )
  .attr("preserveAspectRatio", "xMidYMid meet")
  .style("width", "100%")
  .style("height", "auto");

const aucG = aucSvg
  .append("g")
  .attr("transform", `translate(${aucMargin.left},${aucMargin.top})`);

const aucTooltip = d3.select("#tooltip");

const aucX = d3.scaleLinear().range([0, aucWidth]);
const aucY = d3.scaleBand().range([0, aucHeight]).padding(0.25);

const aucXAxis = aucG
  .append("g")
  .attr("class", "axis")
  .attr("transform", `translate(0,${aucHeight})`);

const aucYAxis = aucG.append("g").attr("class", "axis");

const aucEmptyLabel = aucG
  .append("text")
  .attr("class", "axis-label")
  .attr("x", aucWidth / 2)
  .attr("y", aucHeight / 2)
  .attr("text-anchor", "middle")
  .style("display", "none")
  .text("No data under current filters.");

aucSvg
  .append("text")
  .attr("class", "axis-label")
  .attr("x", aucMargin.left + aucWidth / 2)
  .attr("y", aucHeight + aucMargin.top + 35)
  .attr("text-anchor", "middle")
  .text("AUC-normalized life expectancy (years)");

const incomeColor = {
  "Low income": "#f59e0b",
  "Lower middle income": "#38bdf8",
  "Upper middle income": "#6366f1",
  "High income": "#10b981",
};

let aucData = [];

d3.csv("dataset/life_expectancy_clean.csv").then((raw) => {
  aucData = raw.map((d) => ({
    income_group: d.income_group,
    region: d.region,
    year: +d.year,
    life_expectancy: +d.life_expectancy,
    co2: d.co2 === "" ? null : +d.co2,
  }));

  drawSmoothingChart();
});

function getFilteredAucRows(selectedYear) {
  const activeIncome = window.activeIncomeGroups instanceof Set ? window.activeIncomeGroups : null;
  const dashboardFilters = window.dashboardFilters || {
    regions: new Set(),
    lifeRange: { min: null, max: null },
    co2Range: { min: null, max: null },
  };

  return aucData.filter((d) => {
    if (!Number.isFinite(d.life_expectancy)) return false;

    if (activeIncome && d.income_group && !activeIncome.has(d.income_group)) {
      return false;
    }

    if (dashboardFilters.regions?.size && d.region && !dashboardFilters.regions.has(d.region)) {
      return false;
    }

    // Year filter - if specific year is selected, only include that year
    // If all years selected (null), include all years
    if (Number.isFinite(selectedYear) && d.year !== selectedYear) {
      return false;
    }

    const { lifeRange, co2Range } = dashboardFilters;
    if (lifeRange?.min != null && d.life_expectancy < lifeRange.min)
      return false;
    if (lifeRange?.max != null && d.life_expectancy > lifeRange.max)
      return false;

    // Apply CO2 range filter only if both min and max are defined
    if (co2Range?.min != null && co2Range?.max != null) {
      if (!Number.isFinite(d.co2) || d.co2 < co2Range.min || d.co2 > co2Range.max) {
        return false;
      }
    } else if (co2Range?.min != null) {
      if (!Number.isFinite(d.co2) || d.co2 < co2Range.min) {
        return false;
      }
    } else if (co2Range?.max != null) {
      if (!Number.isFinite(d.co2) || d.co2 > co2Range.max) {
        return false;
      }
    }

    return true;
  });
}

function computeAUCFromYearlyMeans(yearlyRows) {
  const sorted = [...yearlyRows].sort((a, b) => a.year - b.year);
  if (!sorted.length) return null;
  if (sorted.length === 1) {
    return {
      aucRaw: sorted[0].life,
      aucNormalized: sorted[0].life,
      spanYears: 1,
    };
  }

  let aucRaw = 0;
  for (let i = 0; i < sorted.length - 1; i += 1) {
    const left = sorted[i];
    const right = sorted[i + 1];
    const dx = right.year - left.year;
    aucRaw += ((left.life + right.life) / 2) * dx;
  }

  const spanYears = Math.max(
    1,
    sorted[sorted.length - 1].year - sorted[0].year,
  );
  return {
    aucRaw,
    aucNormalized: aucRaw / spanYears,
    spanYears,
  };
}

function drawSmoothingChart(selectedYear = null) {
  if (!aucData.length) return;

  const rows = getFilteredAucRows(selectedYear);

  const bars = d3
    .rollups(
      rows,
      (groupRows) => {
        const yearlyMeans = d3
          .rollups(
            groupRows,
            (v) => d3.mean(v, (d) => d.life_expectancy),
            (d) => d.year,
          )
          .map(([year, life]) => ({ year, life }))
          .filter((d) => Number.isFinite(d.life));

        const aucStats = computeAUCFromYearlyMeans(yearlyMeans);
        return {
          aucRaw: aucStats?.aucRaw ?? null,
          aucNormalized: aucStats?.aucNormalized ?? null,
          spanYears: aucStats?.spanYears ?? 0,
          points: groupRows.length,
        };
      },
      (d) => d.income_group,
    )
    .map(([income_group, stats]) => ({ income_group, ...stats }))
    .filter((d) => d.income_group && Number.isFinite(d.aucNormalized))
    .sort((a, b) => b.aucNormalized - a.aucNormalized);

  if (!bars.length) {
    aucG.selectAll(".auc-bar").remove();
    aucG.selectAll(".auc-value").remove();
    aucXAxis.call(d3.axisBottom(aucX).tickValues([]));
    aucYAxis.call(d3.axisLeft(aucY).tickValues([]));
    aucEmptyLabel.style("display", null);
    return;
  }

  aucEmptyLabel.style("display", "none");

  aucX.domain([0, d3.max(bars, (d) => d.aucNormalized) * 1.1]).nice();
  aucY.domain(bars.map((d) => d.income_group));

  aucXAxis.call(d3.axisBottom(aucX).ticks(6));
  aucYAxis.call(d3.axisLeft(aucY));

  aucG
    .selectAll(".auc-bar")
    .data(bars, (d) => d.income_group)
    .join("rect")
    .attr("class", "auc-bar")
    .attr("x", 0)
    .attr("y", (d) => aucY(d.income_group))
    .attr("height", aucY.bandwidth())
    .attr("width", (d) => aucX(d.aucNormalized))
    .attr("fill", (d) => incomeColor[d.income_group] || "#64748b")
    .attr("opacity", 0.9)
    .on("mouseover", (event, d) => {
      aucTooltip
        .style("opacity", 1)
        .html(
          `${d.income_group}<br/>AUC: ${d.aucRaw.toFixed(1)}<br/>Normalized AUC: ${d.aucNormalized.toFixed(
            2,
          )}<br/>Years span: ${d.spanYears}<br/>Filtered records: ${d.points}`,
        );
    })
    .on("mousemove", (event) => {
      aucTooltip
        .style("left", `${event.pageX + 12}px`)
        .style("top", `${event.pageY + 12}px`);
    })
    .on("mouseout", () => aucTooltip.style("opacity", 0));

  aucG
    .selectAll(".auc-value")
    .data(bars, (d) => d.income_group)
    .join("text")
    .attr("class", "auc-value")
    .attr("x", (d) => aucX(d.aucNormalized) + 6)
    .attr("y", (d) => aucY(d.income_group) + aucY.bandwidth() / 2)
    .attr("dominant-baseline", "middle")
    .style("font-size", "11px")
    .style("fill", "#1e293b")
    .text((d) => d.aucNormalized.toFixed(2));
}
