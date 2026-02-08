/**
 * Chart 2 — Life Expectancy vs CO₂ Emissions
 * Scatter plot with income group filtering and trend lines
 */

const scatterMargin = { top: 60, right: 200, bottom: 70, left: 90 };
const scatterWidth = 940 - scatterMargin.left - scatterMargin.right;
const scatterHeight = 420 - scatterMargin.top - scatterMargin.bottom;

const scatterSvg = d3
  .select("#chart2")
  .append("svg")
  .attr("width", scatterWidth + scatterMargin.left + scatterMargin.right)
  .attr("height", scatterHeight + scatterMargin.top + scatterMargin.bottom)
  .attr(
    "viewBox",
    `0 0 ${scatterWidth + scatterMargin.left + scatterMargin.right} ${
      scatterHeight + scatterMargin.top + scatterMargin.bottom
    }`,
  )
  .attr("preserveAspectRatio", "xMidYMid meet")
  .style("width", "100%")
  .style("height", "auto");

const scatterG = scatterSvg
  .append("g")
  .attr("transform", `translate(${scatterMargin.left},${scatterMargin.top})`);

const scatterTooltip = d3.select("#tooltip");

// Scales
const xScale = d3.scaleLog().range([0, scatterWidth]);
const yScale = d3.scaleLinear().range([scatterHeight, 0]);

const scatterColorScale = d3
  .scaleOrdinal()
  .domain([
    "Low income",
    "Lower middle income",
    "Upper middle income",
    "High income",
  ])
  .range(["#d73027", "#fc8d59", "#91bfdb", "#4575b4"]);

// Axes groups
const xAxisGroup = scatterG
  .append("g")
  .attr("class", "axis")
  .attr("transform", `translate(0,${scatterHeight})`);

const yAxisGroup = scatterG.append("g").attr("class", "axis");

const r2YOffset = {
  "High income": -18,
  "Upper middle income": -6,
  "Lower middle income": 8,
  "Low income": 20,
};

const r2LabelY = {
  "High income": 35,
  "Upper middle income": 55,
  "Lower middle income": 75,
  "Low income": 95,
};

// Axis labels
scatterSvg
  .append("text")
  .attr("class", "axis-label")
  .attr("x", scatterMargin.left + scatterWidth / 2)
  .attr("y", scatterHeight + scatterMargin.top + 45)
  .attr("text-anchor", "middle")
  .text("CO₂ emissions (log scale)");

scatterSvg
  .append("text")
  .attr("class", "axis-label")
  .attr("transform", "rotate(-90)")
  .attr("x", -(scatterMargin.top + scatterHeight / 2))
  .attr("y", 20)
  .attr("text-anchor", "middle")
  .text("Life Expectancy (years)");

// Load data once
let scatterData = [];

d3.csv("dataset/life_expectancy_clean.csv").then((data) => {
  scatterData = data.map((d) => ({
    ...d,
    year: +d.year,
    co2: +d.co2,
    life_expectancy: +d.life_expectancy,
  }));

  drawScatter(+d3.select("#year-slider").property("value"));
});

function getActiveGroups() {
  return window.activeIncomeGroups || new Set(scatterColorScale.domain());
}

function getDashboardFilters() {
  return (
    window.dashboardFilters || {
      regions: new Set(),
      lifeRange: { min: null, max: null },
      co2Range: { min: null, max: null },
    }
  );
}

/**
 * Main draw function (called from main.js)
 */
function drawScatter(selectedYear) {
  const activeGroups = getActiveGroups();
  const filters = getDashboardFilters();
  const isAllYears = !Number.isFinite(selectedYear);
  const filtered = scatterData
    .filter((d) => d.co2 > 0 && d.life_expectancy)
    .filter((d) => activeGroups.has(d.income_group))
    .filter((d) =>
      filters?.regions?.size ? filters.regions.has(d.region) : true,
    );

  const yearData = isAllYears
    ? d3
        .rollups(
          filtered,
          (values) => ({
            country: values[0].country,
            country_code: values[0].country_code,
            income_group: values[0].income_group,
            region: values[0].region,
            co2: d3.mean(values, (v) => v.co2),
            life_expectancy: d3.mean(values, (v) => v.life_expectancy),
          }),
          (d) => d.country_code,
        )
        .map(([, value]) => value)
    : filtered.filter((d) => d.year === selectedYear);

  const lifeRange = filters.lifeRange || { min: null, max: null };
  const co2Range = filters.co2Range || { min: null, max: null };
  const rangedData = yearData.filter((d) => {
    if (lifeRange.min != null && d.life_expectancy < lifeRange.min)
      return false;
    if (lifeRange.max != null && d.life_expectancy > lifeRange.max)
      return false;
    if (co2Range.min != null && d.co2 < co2Range.min) return false;
    if (co2Range.max != null && d.co2 > co2Range.max) return false;
    return true;
  });

  scatterG.selectAll(".dot").remove();
  scatterG.selectAll(".trend").remove();
  scatterG.selectAll(".trend-label").remove();
  scatterG.selectAll(".grid").remove();

  if (rangedData.length === 0) {
    xAxisGroup.call(d3.axisBottom(xScale).ticks(6, "~s").tickSizeOuter(0));
    yAxisGroup.call(d3.axisLeft(yScale).ticks(6).tickSizeOuter(0));
    return;
  }

  // Update scales
  xScale.domain(d3.extent(rangedData, (d) => d.co2)).nice();
  yScale.domain(d3.extent(rangedData, (d) => d.life_expectancy)).nice();

  // Axes
  xAxisGroup
    .transition()
    .call(d3.axisBottom(xScale).ticks(6, "~s").tickSizeOuter(0));
  yAxisGroup.transition().call(d3.axisLeft(yScale).ticks(6).tickSizeOuter(0));

  // ---- POINTS ----
  const dots = scatterG
    .selectAll(".dot")
    .data(rangedData, (d) => d.country_code);

  dots
    .join(
      (enter) =>
        enter
          .append("circle")
          .attr("class", "dot")
          .attr("cx", (d) => xScale(d.co2))
          .attr("cy", (d) => yScale(d.life_expectancy))
          .attr("r", 4)
          .attr("fill", (d) => scatterColorScale(d.income_group))
          .attr("opacity", 0.75),

      (update) =>
        update
          .transition()
          .duration(700)
          .attr("cx", (d) => xScale(d.co2))
          .attr("cy", (d) => yScale(d.life_expectancy)),

      (exit) => exit.remove(),
    )
    .on("mouseover", (event, d) => {
      scatterTooltip.style("opacity", 1).html(`
        <strong>${d.country}</strong><br/>
        ${isAllYears ? "Avg Life Expectancy" : "Life Expectancy"}: ${d.life_expectancy.toFixed(
          1,
        )}<br/>
        ${isAllYears ? "Avg CO₂" : "CO₂"}: ${d.co2.toLocaleString()}<br/>
        Income Group: ${d.income_group}
      `);
    })
    .on("mousemove", (event) => {
      scatterTooltip
        .style("left", event.pageX + 12 + "px")
        .style("top", event.pageY + 12 + "px");
    })
    .on("mouseout", () => {
      scatterTooltip.style("opacity", 0);
    });

  scatterG
    .selectAll(".dot")
    .classed(
      "dimmed",
      (d) =>
        window.selectedCountryCode &&
        d.country_code !== window.selectedCountryCode,
    );

  drawTrendLines(rangedData);
}

/**
 * Trend lines per income group
 */
function drawTrendLines(data) {
  scatterG.selectAll(".trend").remove();
  scatterG.selectAll(".trend-label").remove();
  scatterG.selectAll(".grid").remove();

  scatterG
    .append("g")
    .attr("class", "grid")
    .call(d3.axisLeft(yScale).ticks(5).tickSize(-scatterWidth).tickFormat(""))
    .attr("opacity", 0.12);

  const groups = d3.group(data, (d) => d.income_group);

  groups.forEach((values, group) => {
    if (values.length < 5) return;

    const predict = linearRegression(values);
    const r2 = computeR2(values, predict);
    const xExtent = d3.extent(values, (d) => d.co2);

    const lineData = xExtent.map((x) => ({
      co2: x,
      life: predict(Math.log(x)),
    }));

    scatterG
      .append("path")
      .datum(lineData)
      .attr("class", "trend")
      .attr("stroke", scatterColorScale(group))
      .attr("stroke-width", 1.5)
      .attr("stroke-dasharray", "4 4")
      .attr("fill", "none")
      .attr(
        "d",
        d3
          .line()
          .x((d) => xScale(d.co2))
          .y((d) => yScale(d.life)),
      );

    scatterG
      .append("text")
      .attr("class", "trend-label")
      .attr("x", scatterWidth + 180)
      .attr("y", r2LabelY[group])
      .attr("text-anchor", "end")
      .attr("fill", scatterColorScale(group))
      .attr("font-size", "11px")
      .attr("font-weight", "600")
      .text(`${group}: R² = ${r2.toFixed(2)}`);
  });
}

function linearRegression(data) {
  const n = data.length;
  const sumX = d3.sum(data, (d) => Math.log(d.co2));
  const sumY = d3.sum(data, (d) => d.life_expectancy);
  const sumXY = d3.sum(data, (d) => Math.log(d.co2) * d.life_expectancy);
  const sumXX = d3.sum(data, (d) => Math.log(d.co2) ** 2);

  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX ** 2);
  const intercept = (sumY - slope * sumX) / n;

  return (x) => slope * x + intercept;
}

function computeR2(data, predict) {
  const meanY = d3.mean(data, (d) => d.life_expectancy);

  const ssTot = d3.sum(data, (d) => (d.life_expectancy - meanY) ** 2);

  const ssRes = d3.sum(
    data,
    (d) => (d.life_expectancy - predict(Math.log(d.co2))) ** 2,
  );

  return 1 - ssRes / ssTot;
}
