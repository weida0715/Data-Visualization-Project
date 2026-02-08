/**
 * Chart 6 — Missing Data Transparency
 * Horizontal bar chart for missing ratios
 */

const missingMargin = { top: 40, right: 40, bottom: 40, left: 160 };
const missingWidth = 900 - missingMargin.left - missingMargin.right;
const missingHeight = 420 - missingMargin.top - missingMargin.bottom;

const missingSvg = d3
  .select("#chart6")
  .append("svg")
  .attr("width", missingWidth + missingMargin.left + missingMargin.right)
  .attr("height", missingHeight + missingMargin.top + missingMargin.bottom)
  .attr(
    "viewBox",
    `0 0 ${missingWidth + missingMargin.left + missingMargin.right} ${
      missingHeight + missingMargin.top + missingMargin.bottom
    }`,
  )
  .attr("preserveAspectRatio", "xMidYMid meet")
  .style("width", "100%")
  .style("height", "auto");

const missingG = missingSvg
  .append("g")
  .attr("transform", `translate(${missingMargin.left},${missingMargin.top})`);

const missingTooltip = d3.select("#tooltip");

const missingX = d3.scaleLinear().range([0, missingWidth]);
const missingY = d3.scaleBand().range([0, missingHeight]).padding(0.2);

const missingXAxis = missingG
  .append("g")
  .attr("class", "axis")
  .attr("transform", `translate(0,${missingHeight})`);

const missingYAxis = missingG.append("g").attr("class", "axis");

missingSvg
  .append("text")
  .attr("class", "axis-label")
  .attr("x", missingMargin.left + missingWidth / 2)
  .attr("y", missingHeight + missingMargin.top + 32)
  .attr("text-anchor", "middle")
  .text("Missing ratio");

let missingData = [];
let missingYears = [];

const missingVariables = [
  "corruption",
  "sanitation",
  "education_exp_pct",
  "undernourishment",
  "health_exp_pct",
  "unemployment",
  "co2",
];

d3.csv("dataset/life_expectancy_advanced.csv").then((raw) => {
  const parsed = raw.map((d) => ({
    year: +d.year,
    corruption: d.corruption === "" ? null : +d.corruption,
    sanitation: d.sanitation === "" ? null : +d.sanitation,
    education_exp_pct: d.education_exp_pct === "" ? null : +d.education_exp_pct,
    undernourishment: d.undernourishment === "" ? null : +d.undernourishment,
    health_exp_pct: d.health_exp_pct === "" ? null : +d.health_exp_pct,
    unemployment: d.unemployment === "" ? null : +d.unemployment,
    co2: d.co2 === "" ? null : +d.co2,
  }));

  const byYear = d3.group(parsed, (d) => d.year);
  missingYears = Array.from(byYear.keys()).sort((a, b) => a - b);
  missingData = missingYears.map((year) => {
    const records = byYear.get(year) || [];
    const totals = records.length || 1;
    const ratios = {};
    const counts = {};

    missingVariables.forEach((variable) => {
      const missingCount = records.reduce(
        (acc, row) => (row[variable] == null ? acc + 1 : acc),
        0,
      );
      ratios[variable] = missingCount / totals;
      counts[variable] = missingCount;
    });

    return { year, ratios, counts, totals };
  });

  const totalAll = parsed.length || 1;
  const allRatios = {};
  const allCounts = {};

  missingVariables.forEach((variable) => {
    const missingCount = parsed.reduce(
      (acc, row) => (row[variable] == null ? acc + 1 : acc),
      0,
    );
    allRatios[variable] = missingCount / totalAll;
    allCounts[variable] = missingCount;
  });

  missingData.push({
    year: "all",
    ratios: allRatios,
    counts: allCounts,
    totals: totalAll,
  });

  drawMissingChart(null);
});

function drawMissingChart(year) {
  if (missingData.length === 0) return;

  const isAllYears = !Number.isFinite(year);
  const selectedKey = isAllYears ? "all" : year;
  const yearEntry =
    missingData.find((d) => d.year === selectedKey) || missingData[0];

  const sorted = missingVariables
    .map((variable) => ({
      variable,
      missing_ratio: yearEntry?.ratios?.[variable] ?? 0,
      missing_count: yearEntry?.counts?.[variable] ?? 0,
      total_count: yearEntry?.totals ?? 0,
    }))
    .sort((a, b) => b.missing_ratio - a.missing_ratio);

  missingX.domain([0, 1]);
  missingY.domain(sorted.map((d) => d.variable));

  missingXAxis.call(
    d3.axisBottom(missingX).ticks(5).tickFormat(d3.format(".0%")),
  );
  missingYAxis.call(d3.axisLeft(missingY));

  const bars = missingG
    .selectAll(".missing-bar")
    .data(sorted, (d) => d.variable);

  bars
    .join("rect")
    .attr("class", "missing-bar")
    .attr("x", 0)
    .attr("y", (d) => missingY(d.variable))
    .attr("height", missingY.bandwidth())
    .attr("width", (d) => missingX(d.missing_ratio))
    .attr("fill", "#94a3b8")
    .on("mouseover", (event, d) => {
      missingTooltip
        .style("opacity", 1)
        .html(
          `${d.variable}<br/>Missing: ${d.missing_count} / ${d.total_count} (${(
            d.missing_ratio * 100
          ).toFixed(1)}%)`,
        );
    })
    .on("mousemove", (event) => {
      missingTooltip
        .style("left", event.pageX + 12 + "px")
        .style("top", event.pageY + 12 + "px");
    })
    .on("mouseout", () => missingTooltip.style("opacity", 0));
}
