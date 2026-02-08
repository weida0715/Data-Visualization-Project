/**
 * Chart 3 — Life Expectancy Trends by Income Group
 * Line chart with yearly dots + tooltip interaction
 */

/* =========================
   Layout
========================= */
const trendMargin = { top: 60, right: 160, bottom: 70, left: 80 };
const trendWidth = 940 - trendMargin.left - trendMargin.right;
const trendHeight = 420 - trendMargin.top - trendMargin.bottom;

const trendSvg = d3
  .select("#chart3")
  .append("svg")
  .attr("width", trendWidth + trendMargin.left + trendMargin.right)
  .attr("height", trendHeight + trendMargin.top + trendMargin.bottom)
  .attr(
    "viewBox",
    `0 0 ${trendWidth + trendMargin.left + trendMargin.right} ${
      trendHeight + trendMargin.top + trendMargin.bottom
    }`,
  )
  .attr("preserveAspectRatio", "xMidYMid meet")
  .style("width", "100%")
  .style("height", "auto");

const trendG = trendSvg
  .append("g")
  .attr("transform", `translate(${trendMargin.left},${trendMargin.top})`);

const trendTooltip = d3.select("#tooltip");

/* =========================
   Scales
========================= */
const TrendXScale = d3.scaleLinear().range([0, trendWidth]);
const TrendYScale = d3.scaleLinear().range([trendHeight, 0]);

const TrendColorScale = d3
  .scaleOrdinal()
  .domain([
    "Low income",
    "Lower middle income",
    "Upper middle income",
    "High income",
  ])
  .range(["#d73027", "#fc8d59", "#91bfdb", "#4575b4"]);

/* =========================
   Axes
========================= */
const xAxisG = trendG
  .append("g")
  .attr("class", "axis")
  .attr("transform", `translate(0,${trendHeight})`);

const yAxisG = trendG.append("g").attr("class", "axis");

/* =========================
   Axis Labels
========================= */
trendSvg
  .append("text")
  .attr("class", "axis-label")
  .attr("x", trendMargin.left + trendWidth / 2)
  .attr("y", trendHeight + trendMargin.top + 40)
  .attr("text-anchor", "middle")
  .text("Year");

trendSvg
  .append("text")
  .attr("class", "axis-label")
  .attr("transform", "rotate(-90)")
  .attr("x", -(trendMargin.top + trendHeight / 2))
  .attr("y", 20)
  .attr("text-anchor", "middle")
  .text("Average Life Expectancy (years)");

/* =========================
   Line Generator
========================= */
const lineGen = d3
  .line()
  .x((d) => TrendXScale(d.year))
  .y((d) => TrendYScale(d.life_expectancy));

/* =========================
   Shared Active Groups
========================= */
function getActiveGroups() {
  return (
    window.activeIncomeGroups ||
    new Set(
      Array.from(document.querySelectorAll(".income-checkbox"))
        .filter((cb) => cb.checked)
        .map((cb) => cb.value),
    )
  );
}

/* =========================
   Data
========================= */
let data = [];

d3.csv("dataset/income_year_summary.csv").then((raw) => {
  data = raw.map((d) => ({
    income_group: d.income_group,
    year: +d.year,
    life_expectancy: +d.life_expectancy,
  }));

  drawTrendChart(null);
});

/* =========================
   Draw Function
========================= */
function drawTrendChart(selectedYear) {
  const activeGroups = getActiveGroups();
  const isAllYears = !Number.isFinite(selectedYear);
  
  // Get data from main dataset instead of summary to apply all filters
  d3.csv("dataset/life_expectancy_clean.csv").then((rawData) => {
    const allData = rawData.map((d) => ({
      income_group: d.income_group,
      region: d.region,
      year: +d.year,
      life_expectancy: +d.life_expectancy,
      co2: d.co2 === "" ? null : +d.co2,
    }));

    const filters = window.dashboardFilters || {};
    const selectedRegions = filters.regions || new Set();
    const { lifeRange, co2Range } = filters;

    const filtered = allData.filter((d) => {
      // Income group filter
      const incomeFilter = activeGroups.has(d.income_group);
      
      // Region filter
      const regionFilter = !selectedRegions.size || selectedRegions.has(d.region);
      
      // Year filter - show all years up to selected year (instead of just single year)
      const yearFilter = isAllYears || d.year <= selectedYear;
      
      // Life expectancy range filter
      const lifeFilter = (lifeRange.min == null || d.life_expectancy >= lifeRange.min) && 
                          (lifeRange.max == null || d.life_expectancy <= lifeRange.max);
      
      // CO2 range filter
      const co2Filter = (co2Range.min == null || co2Range.max == null) || 
                        (Number.isFinite(d.co2) && d.co2 >= co2Range.min && d.co2 <= co2Range.max);

      return incomeFilter && regionFilter && yearFilter && lifeFilter && co2Filter;
    });

    // Calculate income group averages from filtered data
    const incomeGroupData = d3.rollups(
      filtered,
      (v) => ({
        life_expectancy: d3.mean(v, (d) => d.life_expectancy),
        count: v.length
      }),
      (d) => d.income_group,
      (d) => d.year
    )
    .flatMap(([income_group, yearGroups]) => 
      Array.from(yearGroups, ([year, stats]) => ({
        income_group,
        year: year,
        life_expectancy: stats.life_expectancy,
        count: stats.count
      }))
    )
    .filter(d => Number.isFinite(d.life_expectancy));

    const grouped = d3.group(incomeGroupData, (d) => d.income_group);

    trendG.selectAll(".trend-line").remove();
    trendG.selectAll(".trend-dot").remove();
    trendG.selectAll(".trend-label").remove();

    /* ---------- Scales ---------- */
    const xDomain = isAllYears 
      ? d3.extent(incomeGroupData, (d) => d.year) 
      : [d3.min(incomeGroupData, (d) => d.year), selectedYear];
    TrendXScale.domain(xDomain);
    TrendYScale.domain([40, 85]); // fixed = fair comparison

    // Custom tick generator to ensure unique integer years
    const xTicks = [];
    const xStart = Math.floor(xDomain[0]);
    const xEnd = Math.ceil(xDomain[1]);
    const tickStep = Math.max(1, Math.floor((xEnd - xStart) / 5)); // Aim for ~5-6 ticks
    
    for (let i = xStart; i <= xEnd; i += tickStep) {
      xTicks.push(i);
    }
    
    // Add final tick if not included
    if (xTicks[xTicks.length - 1] < xEnd) {
      xTicks.push(xEnd);
    }
    
    xAxisG.call(d3.axisBottom(TrendXScale).tickValues(xTicks).tickFormat(d3.format("d")));
    yAxisG.call(d3.axisLeft(TrendYScale).ticks(6));

    trendG.selectAll(".trend-grid").remove();
    trendG
      .append("g")
      .attr("class", "trend-grid")
      .call(
        d3.axisLeft(TrendYScale).ticks(5).tickSize(-trendWidth).tickFormat(""),
      )
      .attr("opacity", 0.12);

    if (incomeGroupData.length === 0) {
      return;
    }

    /* ---------- Lines ---------- */
    const lines = trendG.selectAll(".trend-line").data(grouped, (d) => d[0]);

    lines.join(
      (enter) =>
        enter
          .append("path")
          .attr("class", "trend-line")
          .attr("fill", "none")
          .attr("stroke", (d) => TrendColorScale(d[0]))
          .attr("stroke-width", 2)
          .attr("opacity", 0.9)
          .attr("d", (d) => lineGen(d[1])),

      (update) =>
        update
          .transition()
          .duration(700)
          .attr("d", (d) => lineGen(d[1])),

      (exit) => exit.remove(),
    );

    /* ---------- Dots ---------- */
    const dots = trendG
      .selectAll(".trend-dot")
      .data(incomeGroupData, (d) => `${d.income_group}-${d.year}`);

    dots.join(
      (enter) =>
        enter
          .append("circle")
          .attr("class", "trend-dot")
          .attr("r", 3.5)
          .attr("cx", (d) => TrendXScale(d.year))
          .attr("cy", (d) => TrendYScale(d.life_expectancy))
          .attr("fill", (d) => TrendColorScale(d.income_group))
          .attr("opacity", 0.9)
          .style("pointer-events", "all")
          .on("mouseover", function (event, d) {
            d3.select(this).attr("r", 6);

            trendTooltip.style("opacity", 1).html(`
              <strong>${d.income_group}</strong><br/>
              Year: ${d.year}<br/>
              Income Group: ${d.income_group}<br/>
              Average Life Expectancy: ${d.life_expectancy.toFixed(1)}<br/>
              Countries: ${d.count}
              `);
          })
          .on("mousemove", function (event) {
            trendTooltip
              .style("left", event.pageX + 12 + "px")
              .style("top", event.pageY + 12 + "px");
          })
          .on("mouseout", function () {
            d3.select(this).attr("r", 3.5);
            trendTooltip.style("opacity", 0);
          }),

      (update) =>
        update
          .transition()
          .duration(700)
          .attr("cx", (d) => TrendXScale(d.year))
          .attr("cy", (d) => TrendYScale(d.life_expectancy)),

      (exit) => exit.remove(),
    );

    /* ---------- End Labels ---------- */
    const labels = trendG.selectAll(".trend-label").data(grouped, (d) => d[0]);

    labels.join(
      (enter) =>
        enter
          .append("text")
          .attr("class", "trend-label")
          .attr("x", trendWidth + 20)
          .attr("y", (d) => TrendYScale(d[1][d[1].length - 1].life_expectancy))
          .attr("text-anchor", "start")
          .attr("fill", (d) => TrendColorScale(d[0]))
          .attr("font-size", "11px")
          .text((d) => d[0]),

      (update) =>
        update
          .transition()
          .duration(700)
          .attr("y", (d) => TrendYScale(d[1][d[1].length - 1].life_expectancy)),

      (exit) => exit.remove(),
    );
  });
}

// Note: checkbox handler managed in main.js for synchronized updates
