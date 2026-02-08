const slider = d3.select("#year-slider");
const yearLabel = d3.select("#year-label");
const playBtn = d3.select("#play-btn");
const yearTicks = d3.select("#year-ticks");
const regionFilters = d3.select("#region-filters");
const lifeMinInput = d3.select("#life-min");
const lifeMaxInput = d3.select("#life-max");
const lifeMinLabel = d3.select("#life-min-label");
const lifeMaxLabel = d3.select("#life-max-label");
const co2MinInput = d3.select("#co2-min");
const co2MaxInput = d3.select("#co2-max");
const co2MinLabel = d3.select("#co2-min-label");
const co2MaxLabel = d3.select("#co2-max-label");
const resetBtn = d3.select("#reset-filters");

const START_YEAR = 2001;
const END_YEAR = 2019;
const ALL_YEARS_VALUE = START_YEAR - 1;
const ALL_YEARS_LABEL = "All Year";

let years = [ALL_YEARS_VALUE, ...d3.range(START_YEAR, END_YEAR + 1)];
let playInterval = null;
let isPlaying = false;
let isYearFiltered = true;

const dashboardFilters = {
  regions: new Set(),
  lifeRange: { min: null, max: null },
  co2Range: { min: null, max: null },
};

window.dashboardFilters = dashboardFilters;

const lifeFormatter = d3.format(".1f");
const co2Formatter = d3.format(",.0f");

function updateActiveIncomeGroups() {
  const active = new Set(
    Array.from(document.querySelectorAll(".income-checkbox"))
      .filter((cb) => cb.checked)
      .map((cb) => cb.value),
  );
  window.activeIncomeGroups = active;
  return active;
}

function updateActiveRegions() {
  const selected = new Set(
    Array.from(document.querySelectorAll(".region-checkbox"))
      .filter((cb) => cb.checked)
      .map((cb) => cb.value),
  );

  if (selected.size === 0) {
    document.querySelectorAll(".region-checkbox").forEach((cb) => {
      cb.checked = true;
      selected.add(cb.value);
    });
  }

  dashboardFilters.regions = selected;
  return selected;
}

function updateRangeLabels() {
  if (dashboardFilters.lifeRange.min != null) {
    lifeMinLabel.text(lifeFormatter(dashboardFilters.lifeRange.min));
    lifeMaxLabel.text(lifeFormatter(dashboardFilters.lifeRange.max));
  }
  if (dashboardFilters.co2Range.min != null) {
    co2MinLabel.text(co2Formatter(dashboardFilters.co2Range.min));
    co2MaxLabel.text(co2Formatter(dashboardFilters.co2Range.max));
  }
}

function syncLifeRange(source) {
  let minValue = +lifeMinInput.property("value");
  let maxValue = +lifeMaxInput.property("value");

  if (minValue > maxValue) {
    if (source === "min") {
      maxValue = minValue;
      lifeMaxInput.property("value", maxValue);
    } else {
      minValue = maxValue;
      lifeMinInput.property("value", minValue);
    }
  }

  dashboardFilters.lifeRange = { min: minValue, max: maxValue };
  updateRangeLabels();
}

function syncCo2Range(source) {
  let minValue = +co2MinInput.property("value");
  let maxValue = +co2MaxInput.property("value");

  if (minValue > maxValue) {
    if (source === "min") {
      maxValue = minValue;
      co2MaxInput.property("value", maxValue);
    } else {
      minValue = maxValue;
      co2MinInput.property("value", minValue);
    }
  }

  dashboardFilters.co2Range = { min: minValue, max: maxValue };
  updateRangeLabels();
}

function redrawDashboard(year) {
  const filterYear = year === ALL_YEARS_VALUE ? null : year;
  drawLifeExpectancyMap(filterYear);
  drawScatter(filterYear);
  drawTrendChart(filterYear);
  if (typeof drawRegionChart === "function") {
    drawRegionChart();
  }
  if (typeof drawSmoothingChart === "function") {
    drawSmoothingChart();
  }
  if (typeof drawMissingChart === "function") {
    drawMissingChart(filterYear);
  }
}

function renderYearTicks() {
  if (yearTicks.empty()) return;

  const tickYears = [ALL_YEARS_VALUE, ...d3.range(START_YEAR, END_YEAR + 1)];

  yearTicks
    .selectAll("span")
    .data(tickYears)
    .join("span")
    .text((year) => (year === ALL_YEARS_VALUE ? ALL_YEARS_LABEL : year));
}

function getYearFilter() {
  return +slider.property("value");
}

// Load data
d3.csv("dataset/life_expectancy_clean.csv").then(() => {
  d3.csv("dataset/life_expectancy_clean.csv").then((raw) => {
    const parsed = raw.map((d) => ({
      region: d.region,
      life_expectancy: +d.life_expectancy,
      co2: d.co2 === "" ? null : +d.co2,
    }));

    const regions = Array.from(
      new Set(parsed.map((d) => d.region).filter(Boolean)),
    ).sort();

    const lifeExtent = d3.extent(parsed, (d) => d.life_expectancy);
    const co2Extent = d3.extent(
      parsed.filter((d) => Number.isFinite(d.co2) && d.co2 > 0),
      (d) => d.co2,
    );

    regionFilters.selectAll("label").remove();
    const regionLabels = regionFilters
      .selectAll("label")
      .data(regions)
      .join("label");

    regionLabels.each(function (region) {
      const label = d3.select(this);
      label.selectAll("*").remove();
      label
        .append("input")
        .attr("type", "checkbox")
        .attr("class", "region-checkbox")
        .attr("value", region)
        .property("checked", true);
      label.append("span").text(region);
    });

    dashboardFilters.regions = new Set(regions);
    dashboardFilters.lifeRange = {
      min: lifeExtent[0],
      max: lifeExtent[1],
    };
    dashboardFilters.co2Range = {
      min: co2Extent[0],
      max: co2Extent[1],
    };

    lifeMinInput
      .attr("min", lifeExtent[0])
      .attr("max", lifeExtent[1])
      .attr("step", 0.1)
      .property("value", lifeExtent[0]);
    lifeMaxInput
      .attr("min", lifeExtent[0])
      .attr("max", lifeExtent[1])
      .attr("step", 0.1)
      .property("value", lifeExtent[1]);

    co2MinInput
      .attr("min", co2Extent[0])
      .attr("max", co2Extent[1])
      .attr("step", 1000)
      .property("value", co2Extent[0]);
    co2MaxInput
      .attr("min", co2Extent[0])
      .attr("max", co2Extent[1])
      .attr("step", 1000)
      .property("value", co2Extent[1]);

    updateRangeLabels();

    d3.selectAll(".region-checkbox").on("change", function () {
      updateActiveRegions();
      redrawDashboard(getYearFilter());
    });

    lifeMinInput.on("input", function () {
      syncLifeRange("min");
      redrawDashboard(getYearFilter());
    });

    lifeMaxInput.on("input", function () {
      syncLifeRange("max");
      redrawDashboard(getYearFilter());
    });

    co2MinInput.on("input", function () {
      syncCo2Range("min");
      redrawDashboard(getYearFilter());
    });

    co2MaxInput.on("input", function () {
      syncCo2Range("max");
      redrawDashboard(getYearFilter());
    });

    resetBtn.on("click", () => {
      document.querySelectorAll(".income-checkbox").forEach((cb) => {
        cb.checked = true;
      });
      document.querySelectorAll(".region-checkbox").forEach((cb) => {
        cb.checked = true;
      });

      updateActiveIncomeGroups();
      updateActiveRegions();

      lifeMinInput.property("value", lifeExtent[0]);
      lifeMaxInput.property("value", lifeExtent[1]);
      co2MinInput.property("value", co2Extent[0]);
      co2MaxInput.property("value", co2Extent[1]);

      syncLifeRange("min");
      syncCo2Range("min");
      redrawDashboard(getYearFilter());
    });
  });

  // Configure slider
  slider
    .attr("min", ALL_YEARS_VALUE)
    .attr("max", END_YEAR)
    .attr("step", 1)
    .attr("value", ALL_YEARS_VALUE);

  renderYearTicks();

  // Initial label + render
  yearLabel.text(ALL_YEARS_LABEL);
  updateActiveIncomeGroups();
  updateActiveRegions();
  redrawDashboard(ALL_YEARS_VALUE);

  // Slider interaction
  slider.on("input", function () {
    const year = +this.value;
    yearLabel.text(year === ALL_YEARS_VALUE ? ALL_YEARS_LABEL : year);
    redrawDashboard(year);
    stopPlaying();
  });

  d3.selectAll(".income-checkbox").on("change", function () {
    updateActiveIncomeGroups();
    redrawDashboard(getYearFilter());
  });

  // Play / Pause button
  playBtn.on("click", togglePlay);
});

// Play / Pause logic
function togglePlay() {
  if (isPlaying) {
    stopPlaying();
  } else {
    startPlaying();
  }
}

function startPlaying() {
  isPlaying = true;
  playBtn.text("⏸ Pause");

  slider.property("value", START_YEAR);
  yearLabel.text(START_YEAR);
  redrawDashboard(START_YEAR);

  playInterval = setInterval(() => {
    let currentYear = +slider.property("value");
    let currentIndex = years.indexOf(currentYear);

    if (currentIndex < years.length - 1) {
      const nextYear = years[currentIndex + 1];
      slider.property("value", nextYear);
      yearLabel.text(nextYear === ALL_YEARS_VALUE ? ALL_YEARS_LABEL : nextYear);

      redrawDashboard(nextYear);
    } else {
      stopPlaying();
    }
  }, 1200);
}

function stopPlaying() {
  isPlaying = false;
  playBtn.text("▶ Play");
  clearInterval(playInterval);
}

// ---------- Chart insight tooltips ----------
const chartInsightText = {
  chart1: "Generating insight...",
  chart2: "Generating insight...",
  chart3: "Generating insight...",
  chart4: "Generating insight...",
  chart5: "Generating insight...",
  chart6: "Generating insight...",
};

function showInfoTooltip(event, text) {
  const infoTooltip = document.getElementById("info-tooltip");
  if (!infoTooltip) return;

  infoTooltip.textContent = text;
  infoTooltip.style.opacity = "1";
  infoTooltip.style.left = `${event.pageX + 12}px`;
  infoTooltip.style.top = `${event.pageY + 12}px`;
}

function hideInfoTooltip() {
  const infoTooltip = document.getElementById("info-tooltip");
  if (!infoTooltip) return;
  infoTooltip.style.opacity = "0";
}

function attachInfoButtons() {
  document.querySelectorAll(".chart-info-btn").forEach((btn) => {
    const key = btn.dataset.chart;

    btn.addEventListener("mouseenter", (event) => {
      showInfoTooltip(event, chartInsightText[key] || "Insight unavailable.");
    });

    btn.addEventListener("mousemove", (event) => {
      showInfoTooltip(event, chartInsightText[key] || "Insight unavailable.");
    });

    btn.addEventListener("mouseleave", hideInfoTooltip);

    btn.addEventListener("focus", (event) => {
      showInfoTooltip(event, chartInsightText[key] || "Insight unavailable.");
    });

    btn.addEventListener("blur", hideInfoTooltip);
  });
}

function avg(values) {
  return values.length ? d3.mean(values) : null;
}

function initChartInsights() {
  Promise.all([
    d3.csv("dataset/life_expectancy_clean.csv"),
    d3.csv("dataset/income_year_summary.csv"),
    d3.csv("dataset/region_year_summary.csv"),
    d3.csv("dataset/life_expectancy_advanced.csv"),
  ])
    .then(([lifeRaw, incomeTrendRaw, regionTrendRaw, advancedRaw]) => {
      const life = lifeRaw.map((d) => ({
        country: d.country,
        country_code: d.country_code,
        income_group: d.income_group,
        region: d.region,
        year: +d.year,
        life_expectancy: +d.life_expectancy,
        co2: d.co2 === "" ? null : +d.co2,
      }));

      const countryMeans = d3
        .rollups(
          life.filter((d) => Number.isFinite(d.life_expectancy)),
          (v) => d3.mean(v, (d) => d.life_expectancy),
          (d) => d.country,
        )
        .map(([country, meanLife]) => ({ country, meanLife }))
        .sort((a, b) => b.meanLife - a.meanLife);

      const topCountry = countryMeans[0];
      const bottomCountry = countryMeans[countryMeans.length - 1];

      chartInsightText.chart1 =
        topCountry && bottomCountry
          ? `Auto insight: Across the full period, ${topCountry.country} records the highest average life expectancy (~${topCountry.meanLife.toFixed(
              1,
            )} years), while ${bottomCountry.country} is lowest (~${bottomCountry.meanLife.toFixed(
              1,
            )}). This highlights a persistent cross-country longevity gap.`
          : "Auto insight unavailable for map chart.";

      const scatterRows = life.filter(
        (d) =>
          Number.isFinite(d.co2) &&
          d.co2 > 0 &&
          Number.isFinite(d.life_expectancy),
      );

      const xMean = d3.mean(scatterRows, (d) => Math.log(d.co2));
      const yMean = d3.mean(scatterRows, (d) => d.life_expectancy);
      const cov = d3.mean(
        scatterRows,
        (d) => (Math.log(d.co2) - xMean) * (d.life_expectancy - yMean),
      );
      const xSd = Math.sqrt(
        d3.mean(scatterRows, (d) => (Math.log(d.co2) - xMean) ** 2),
      );
      const ySd = Math.sqrt(
        d3.mean(scatterRows, (d) => (d.life_expectancy - yMean) ** 2),
      );
      const corr = xSd && ySd ? cov / (xSd * ySd) : null;

      const incomeLife = d3.rollups(
        scatterRows,
        (v) => d3.mean(v, (d) => d.life_expectancy),
        (d) => d.income_group,
      );
      const incomeMap = new Map(incomeLife);
      const highIncomeLife = incomeMap.get("High income");
      const lowIncomeLife = incomeMap.get("Low income");
      const incomeGap =
        Number.isFinite(highIncomeLife) && Number.isFinite(lowIncomeLife)
          ? highIncomeLife - lowIncomeLife
          : null;

      chartInsightText.chart2 =
        corr != null
          ? `Auto insight: Life expectancy and CO₂ (log scale) show a ${corr >= 0 ? "positive" : "negative"} association (r ≈ ${corr.toFixed(
              2,
            )}). The average life expectancy gap between high-income and low-income groups is about ${
              incomeGap != null ? incomeGap.toFixed(1) : "N/A"
            } years.`
          : "Auto insight unavailable for scatter chart.";

      const incomeTrend = incomeTrendRaw.map((d) => ({
        income_group: d.income_group,
        year: +d.year,
        life_expectancy: +d.life_expectancy,
      }));

      const incomeGain = d3
        .rollups(
          incomeTrend,
          (v) => {
            const sorted = v.sort((a, b) => a.year - b.year);
            return {
              start: sorted[0]?.life_expectancy,
              end: sorted[sorted.length - 1]?.life_expectancy,
              gain:
                Number.isFinite(sorted[0]?.life_expectancy) &&
                Number.isFinite(sorted[sorted.length - 1]?.life_expectancy)
                  ? sorted[sorted.length - 1].life_expectancy -
                    sorted[0].life_expectancy
                  : null,
            };
          },
          (d) => d.income_group,
        )
        .map(([group, stats]) => ({ group, ...stats }))
        .filter((d) => Number.isFinite(d.gain))
        .sort((a, b) => b.gain - a.gain);

      const topImproverIncome = incomeGain[0];
      chartInsightText.chart3 = topImproverIncome
        ? `Auto insight: ${topImproverIncome.group} shows the largest improvement over time, rising by about ${topImproverIncome.gain.toFixed(
            1,
          )} years (from ${topImproverIncome.start.toFixed(1)} to ${topImproverIncome.end.toFixed(1)}).`
        : "Auto insight unavailable for income trends chart.";

      const regionTrend = regionTrendRaw.map((d) => ({
        region: d.region,
        year: +d.year,
        life_expectancy: +d.life_expectancy,
      }));

      const regionStats = d3
        .rollups(
          regionTrend,
          (v) => {
            const sorted = v.sort((a, b) => a.year - b.year);
            return {
              latest: sorted[sorted.length - 1]?.life_expectancy,
              gain:
                Number.isFinite(sorted[0]?.life_expectancy) &&
                Number.isFinite(sorted[sorted.length - 1]?.life_expectancy)
                  ? sorted[sorted.length - 1].life_expectancy -
                    sorted[0].life_expectancy
                  : null,
            };
          },
          (d) => d.region,
        )
        .map(([region, stats]) => ({ region, ...stats }));

      const bestLatestRegion = [...regionStats]
        .filter((d) => Number.isFinite(d.latest))
        .sort((a, b) => b.latest - a.latest)[0];
      const bestGainRegion = [...regionStats]
        .filter((d) => Number.isFinite(d.gain))
        .sort((a, b) => b.gain - a.gain)[0];

      chartInsightText.chart4 =
        bestLatestRegion && bestGainRegion
          ? `Auto insight: ${bestLatestRegion.region} currently has the highest regional life expectancy (~${bestLatestRegion.latest.toFixed(
              1,
            )} years), while ${bestGainRegion.region} records the largest long-term gain (~${bestGainRegion.gain.toFixed(
              1,
            )} years).`
          : "Auto insight unavailable for regional trends chart.";

      const advanced = advancedRaw.map((d) => ({
        life_expectancy: d.life_expectancy === "" ? null : +d.life_expectancy,
        life_expectancy_5yr_avg:
          d.life_expectancy_5yr_avg === "" ? null : +d.life_expectancy_5yr_avg,
        interpolated: d.life_expectancy_was_interpolated === "True",
      }));

      const validPairs = advanced.filter(
        (d) =>
          Number.isFinite(d.life_expectancy) &&
          Number.isFinite(d.life_expectancy_5yr_avg),
      );
      const avgAbsGap = d3.mean(validPairs, (d) =>
        Math.abs(d.life_expectancy - d.life_expectancy_5yr_avg),
      );
      const interpolatedShare = d3.mean(advanced, (d) =>
        d.interpolated ? 1 : 0,
      );

      chartInsightText.chart5 =
        avgAbsGap != null
          ? `Auto insight: The 5-year rolling average differs from yearly raw values by about ${avgAbsGap.toFixed(
              2,
            )} years on average, indicating moderate year-to-year volatility. Interpolated records account for roughly ${(
              interpolatedShare * 100
            ).toFixed(1)}% of observations.`
          : "Auto insight unavailable for smoothing chart.";

      const missingVariables = [
        "corruption",
        "sanitation",
        "education_exp_pct",
        "undernourishment",
        "health_exp_pct",
        "unemployment",
        "co2",
      ];

      const missingRatios = missingVariables
        .map((key) => {
          const ratio = d3.mean(advancedRaw, (d) => (d[key] === "" ? 1 : 0));
          return { key, ratio: ratio ?? 0 };
        })
        .sort((a, b) => b.ratio - a.ratio);

      const topMissing = missingRatios[0];
      chartInsightText.chart6 = topMissing
        ? `Auto insight: ${topMissing.key} is the most incomplete field, with about ${(
            topMissing.ratio * 100
          ).toFixed(
            1,
          )}% missing entries. Use this chart to gauge uncertainty before interpreting related patterns.`
        : "Auto insight unavailable for missing-data chart.";
    })
    .catch(() => {
      Object.keys(chartInsightText).forEach((key) => {
        chartInsightText[key] = "Unable to generate insight from dataset.";
      });
    });
}

attachInfoButtons();
initChartInsights();
