import React, { useContext, useEffect, useState } from "react";
import { DataContext } from "../context/DataContext";
import Chart from "react-apexcharts";
import { Tabs, Tab, Button, CircularProgress, Typography } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";

const TimetableWeeklyView = () => {
  const { searchResultsData, lastUpdated, loadingSearchResults } =
    useContext(DataContext);
  const [heatmapSeries, setHeatmapSeries] = useState([]);
  const [barChartSeries, setBarChartSeries] = useState([]);
  const [barChartCategories, setBarChartCategories] = useState([]);
  const [heatmapOptions, setHeatmapOptions] = useState({});
  const [activeTab, setActiveTab] = useState(0); // Default to Bar Chart
  const [showHistogram, setShowHistogram] = useState(false);
  const [selectedDay, setSelectedDay] = useState(null);

  const sortTimesInOrder = (a, b) => {
    const timeToMinutes = (timeStr) => {
      const [time, modifier] = timeStr.split(" ");
      let [hours, minutes] = time.split(":");
      if (hours === "12") hours = modifier === "AM" ? "00" : "12";
      else if (modifier === "PM") hours = String(parseInt(hours, 10) + 12);
      return parseInt(hours, 10) * 60 + parseInt(minutes, 10);
    };
    return timeToMinutes(a) - timeToMinutes(b);
  };

  useEffect(() => {
    if (searchResultsData) {
      const heatmapData = generateHeatmapData(searchResultsData);
      setHeatmapSeries(heatmapData);
      updateHeatmapOptions(searchResultsData);

      const { series, categories } = generateBarChartData(searchResultsData);
      setBarChartSeries(series);
      setBarChartCategories(categories);
    }
  }, [searchResultsData]);

  const generateHeatmapData = (data) => {
    return Object.keys(data)
      .reverse()
      .map((day) => {
        const sortedTimes = Object.keys(data[day]).sort(sortTimesInOrder);
        return {
          name: day,
          data: sortedTimes.map((time) => ({
            x: time,
            y: data[day][time],
          })),
        };
      });
  };

  const generateBarChartData = (data) => {
    const categories = Object.keys(data);
    const series = [
      {
        name: "Total Enrolment",
        data: categories.map((day) =>
          Object.values(data[day]).reduce((total, curr) => total + curr, 0)
        ),
      },
    ];
    return { series, categories };
  };

  const updateHeatmapOptions = (data) => {
    let allEnrolments = [];
    Object.keys(data).forEach((day) => {
      allEnrolments = allEnrolments.concat(Object.values(data[day]));
    });

    allEnrolments.sort((a, b) => a - b);

    const quantiles = [];
    for (let i = 1; i <= 9; i++) {
      const q = Math.floor((i / 10) * allEnrolments.length);
      quantiles.push(allEnrolments[q]);
    }
    quantiles.push(allEnrolments[allEnrolments.length - 1]);

    const colors = [
      "#FDF5F5",
      "#FDECEC",
      "#FACDCD",
      "#F8AFAF",
      "#F49090",
      "#F06A6A",
      "#EB4343",
      "#D73232",
      "#BF2222",
      "#A01010",
    ];

    const ranges = [];
    for (let i = 0; i < quantiles.length - 1; i++) {
      ranges.push({
        from: quantiles[i],
        to: quantiles[i + 1] !== undefined ? quantiles[i + 1] : quantiles[i],
        color: colors[i],
      });
    }

    setHeatmapOptions({
      chart: {
        type: "heatmap",
      },
      plotOptions: {
        heatmap: {
          shadeIntensity: 0.5,
          colorScale: {
            ranges: ranges,
          },
        },
      },
      dataLabels: {
        enabled: false,
      },
      title: {
        text:
          "Enrolment Heatmap " + (loadingSearchResults ? "(Loading...)" : ""),
        style: {
          fontSize: "20px",
        },
      },
    });
  };

  const handleBarClick = (dayIndex) => {
    const clickedDay = barChartCategories[dayIndex];
    setSelectedDay(clickedDay);
    setShowHistogram(true);
  };

  const barChartOptions = {
    chart: {
      type: "bar",
      events: {
        click: function (event, chartContext, config) {
          const dayIndex = config.dataPointIndex;
          if (dayIndex !== -1) {
            handleBarClick(dayIndex);
          }
        },
      },
    },
    plotOptions: {
      bar: {
        horizontal: false,
      },
    },
    dataLabels: {
      enabled: false,
    },
    title: {
      text:
        "Enrolment Bar Chart " + (loadingSearchResults ? "(Loading...)" : ""),
      style: {
        fontSize: "20px",
      },
    },
    subtitle: {
      text: "Click on any bar to view its daily breakdown!",
      align: "left",
      style: {
        fontSize: "14px",
      },
    },
    xaxis: {
      categories: barChartCategories,
    },
    yaxis: {
      title: {
        text: "Total Enrolment",
      },
    },
  };

  const generateHistogramData = (selectedDay) => {
    const dayData = searchResultsData[selectedDay];
    return Object.keys(dayData).map((time) => ({
      x: time,
      y: dayData[time],
    }));
  };

  const histogramOptions = {
    chart: {
      type: "bar",
    },
    plotOptions: {
      bar: {
        horizontal: false,
      },
    },
    dataLabels: {
      enabled: false,
    },
    title: {
      text: `Traffic for ${selectedDay}`,
      align: "center",
      style: {
        fontSize: "20px",
      },
    },
  };

  const handleTabChange = (event, newValue) => {
    setShowHistogram(false);
    setActiveTab(newValue);
  };

  return (
    <section
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        flexDirection: "column",
      }}
    >
      {loadingSearchResults ? (
        <div
          className="flex flex-col justify-center items-center"
          style={{ minHeight: "500px" }}
        >
          <CircularProgress />
          <Typography variant="h6" className="mt-4" sx={{ marginTop: "16px" }}>
            Loading Charts...
          </Typography>
        </div>
      ) : (
        <>
          <Tabs
            value={activeTab}
            onChange={handleTabChange}
            indicatorColor="primary"
            textColor="primary"
            centered
            sx={{ marginBottom: "20px" }}
          >
            <Tab
              label="Bar Chart"
              sx={{ fontFamily: "Arial", fontSize: "16px", fontWeight: "bold" }}
            />
            <Tab
              label="Heatmap"
              sx={{ fontFamily: "Arial", fontSize: "16px", fontWeight: "bold" }}
            />
          </Tabs>

          {showHistogram && selectedDay ? (
            <div className="mb-8" style={{ width: "100%", maxWidth: "90vw" }}>
              <Button
                variant="text"
                onClick={() => setShowHistogram(false)}
                startIcon={<ArrowBackIcon />}
                sx={{
                  color: "#1976D2",
                  textTransform: "none",
                  fontSize: "16px",
                }}
              >
                Back to Weekly View
              </Button>
              <Chart
                options={histogramOptions}
                series={[
                  { name: "Traffic", data: generateHistogramData(selectedDay) },
                ]}
                type="bar"
                height="470"
                width="100%"
              />
            </div>
          ) : activeTab === 1 ? (
            <div className="mb-8" style={{ width: "100%", maxWidth: "90vw" }}>
              <Chart
                key={JSON.stringify(heatmapOptions)}
                options={heatmapOptions}
                series={heatmapSeries}
                type="heatmap"
                height="500"
                width="100%"
              />
            </div>
          ) : (
            <div className="mb-8" style={{ width: "100%", maxWidth: "90vw" }}>
              <Chart
                options={barChartOptions}
                series={barChartSeries}
                type="bar"
                height="500"
                width="100%"
              />
            </div>
          )}

          <Typography variant="body2" sx={{ alignSelf: "flex-start" }}>
            Last updated: {lastUpdated}
          </Typography>
        </>
      )}
    </section>
  );
};

export default TimetableWeeklyView;
