/**
 * Chart 4 — Regional Trends (Comparative)
 * Multi-line chart by region with hover highlight
 */

const regionMargin = { top: 60, right: 140, bottom: 70, left: 90 };
const regionWidth = 980 - regionMargin.left - regionMargin.right;
const regionHeight = 420 - regionMargin.top - regionMargin.bottom;

const regionSvg = d3
  .select("#chart4")
  .append("svg")
  .attr("width", regionWidth + regionMargin.left + regionMargin.right)
  .attr("height", regionHeight + regionMargin.top + regionMargin.bottom)
  .attr(
    "viewBox",
    `0 0 ${regionWidth + regionMargin.left + regionMargin.right} ${
      regionHeight + regionMargin.top + regionMargin.bottom
    }`,
  )
  .attr("preserveAspectRatio", "xMidYMid meet")
  .style("width", "100%")
  .style("height", "auto");

const regionG = regionSvg
  .append("g")
  .attr("transform", `translate(${regionMargin.left},${regionMargin.top})`);

const regionTooltip = d3.select("#tooltip");

const regionX = d3.scaleLinear().range([0, regionWidth]);
const regionY = d3.scaleLinear().range([regionHeight, 0]);

const regionColor = d3.scaleOrdinal(d3.schemeTableau10);

const regionXAxis = regionG
  .append("g")
  .attr("class", "axis")
  .attr("transform", `translate(0,${regionHeight})`);

const regionYAxis = regionG.append("g").attr("class", "axis");

regionSvg
  .append("text")
  .attr("class", "axis-label")
  .attr("x", regionMargin.left + regionWidth / 2)
  .attr("y", regionHeight + regionMargin.top + 40)
  .attr("text-anchor", "middle")
  .text("Year");

regionSvg
  .append("text")
  .attr("class", "axis-label")
  .attr("transform", "rotate(-90)")
  .attr("x", -(regionMargin.top + regionHeight / 2))
  .attr("y", 20)
  .attr("text-anchor", "middle")
  .text("Average Life Expectancy (years)");

const regionLine = d3
  .line()
  .x((d) => regionX(d.year))
  .y((d) => regionY(d.life_expectancy));

let regionData = [];

d3.csv("dataset/region_year_summary.csv").then((raw) => {
  regionData = raw.map((d) => ({
    region: d.region,
    year: +d.year,
    life_expectancy: +d.life_expectancy,
  }));

  drawRegionChart();
});

function drawRegionChart() {
  if (regionData.length === 0) return;

  // Get data from main dataset instead of summary to apply all filters
  d3.csv("dataset/life_expectancy_clean.csv").then((rawData) => {
    const allData = rawData.map((d) => ({
      region: d.region,
      income_group: d.income_group,
      year: +d.year,
      life_expectancy: +d.life_expectancy,
      co2: d.co2 === "" ? null : +d.co2,
    }));

    const filters = window.dashboardFilters || {};
    const selectedRegions = filters.regions || new Set();
    const selectedYear = getYearFilter();
    const isAllYears = selectedYear === (window.ALL_YEARS_VALUE || 2000);
    const activeIncome = window.activeIncomeGroups instanceof Set ? window.activeIncomeGroups : null;
    const { lifeRange, co2Range } = filters;

    const filtered = allData.filter((d) => {
      // Region filter
      const regionFilter = !selectedRegions.size || selectedRegions.has(d.region);
      
      // Income group filter
      const incomeFilter = !activeIncome || !d.income_group || activeIncome.has(d.income_group);
      
      // Year filter - show all years up to selected year (instead of just single year)
      const yearFilter = isAllYears || d.year <= selectedYear;
      
      // Life expectancy range filter
      const lifeFilter = (lifeRange.min == null || d.life_expectancy >= lifeRange.min) && 
                          (lifeRange.max == null || d.life_expectancy <= lifeRange.max);
      
      // CO2 range filter
      const co2Filter = (co2Range.min == null || co2Range.max == null) || 
                        (Number.isFinite(d.co2) && d.co2 >= co2Range.min && d.co2 <= co2Range.max);

      return regionFilter && incomeFilter && yearFilter && lifeFilter && co2Filter;
    });

    // Calculate regional averages from filtered data
    const regionalData = d3.rollups(
      filtered,
      (v) => ({
        life_expectancy: d3.mean(v, (d) => d.life_expectancy),
        count: v.length
      }),
      (d) => d.region,
      (d) => d.year
    )
    .flatMap(([region, yearGroups]) => 
      Array.from(yearGroups, ([year, stats]) => ({
        region,
        year: year,
        life_expectancy: stats.life_expectancy,
        count: stats.count
      }))
    )
    .filter(d => Number.isFinite(d.life_expectancy));

    const grouped = d3.group(regionalData, (d) => d.region);

    const xDomain = isAllYears 
      ? d3.extent(regionalData, (d) => d.year) 
      : [d3.min(regionalData, (d) => d.year), selectedYear];
    regionX.domain(xDomain);
    regionY.domain(d3.extent(regionalData, (d) => d.life_expectancy)).nice();

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
  
  regionXAxis.call(d3.axisBottom(regionX).tickValues(xTicks).tickFormat(d3.format("d")));
  regionYAxis.call(d3.axisLeft(regionY).ticks(6));

  regionG.selectAll(".region-line").remove();
  regionG.selectAll(".region-dot").remove();
  regionG.selectAll(".region-label").remove();
  regionG.selectAll(".region-grid").remove();

  regionG
    .append("g")
    .attr("class", "region-grid")
    .call(d3.axisLeft(regionY).ticks(5).tickSize(-regionWidth).tickFormat(""))
    .attr("opacity", 0.12);

  /* ---------- Lines ---------- */
  const lines = regionG.selectAll(".region-line").data(grouped, (d) => d[0]);

  lines
    .enter()
    .append("path")
    .attr("class", "region-line")
    .attr("fill", "none")
    .attr("stroke", (d) => regionColor(d[0]))
    .attr("stroke-width", 2)
    .attr("opacity", 0.85)
    .attr("d", (d) => regionLine(d[1]))
    .on("mouseover", function (event, d) {
      regionG.selectAll(".region-line").attr("opacity", 0.15);
      d3.select(this).attr("opacity", 1).attr("stroke-width", 3);
      regionTooltip
        .style("opacity", 1)
        .html(`<strong>${d[0]}</strong><br/>Hover to inspect trend`);
    })
    .on("mousemove", (event) => {
      regionTooltip
        .style("left", event.pageX + 12 + "px")
        .style("top", event.pageY + 12 + "px");
    })
    .on("mouseout", function () {
      regionG.selectAll(".region-line").attr("opacity", 0.85);
      d3.select(this).attr("stroke-width", 2);
      regionTooltip.style("opacity", 0);
    });

  /* ---------- Dots ---------- */
  const dots = regionG
    .selectAll(".region-dot")
    .data(regionalData, (d) => `${d.region}-${d.year}`);

  dots
    .enter()
    .append("circle")
    .attr("class", "region-dot")
    .attr("r", 3.5)
    .attr("cx", (d) => regionX(d.year))
    .attr("cy", (d) => regionY(d.life_expectancy))
    .attr("fill", (d) => regionColor(d.region))
    .attr("opacity", 0.9)
    .style("pointer-events", "all")
        .on("mouseover", function (event, d) {
          d3.select(this).attr("r", 6);

          regionTooltip.style("opacity", 1).html(`
            <strong>${d.region}</strong><br/>
            Year: ${d.year}<br/>
            Region: ${d.region}<br/>
            Average Life Expectancy: ${d.life_expectancy.toFixed(1)}<br/>
            Countries: ${d.count}
            `);
        })
    .on("mousemove", function (event) {
      regionTooltip
        .style("left", event.pageX + 12 + "px")
        .style("top", event.pageY + 12 + "px");
    })
    .on("mouseout", function () {
      d3.select(this).attr("r", 3.5);
      regionTooltip.style("opacity", 0);
    });

  /* ---------- End Labels ---------- */
  const labels = regionG.selectAll(".region-label").data(grouped, (d) => d[0]);

  labels
    .enter()
    .append("text")
    .attr("class", "region-label")
    .attr("x", regionWidth + 10)
    .attr("y", (d) => regionY(d[1][d[1].length - 1].life_expectancy))
    .attr("text-anchor", "start")
    .attr("fill", (d) => regionColor(d[0]))
    .attr("font-size", "11px")
    .text((d) => d[0]);
  });
}
