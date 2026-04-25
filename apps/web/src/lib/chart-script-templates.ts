export const defaultChartBarScript = `async function generateChartOption(context) {
  const { params } = context;
  const labels = Array.isArray(params.labels) ? params.labels : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
  const values = Array.isArray(params.values) ? params.values : [120, 200, 150, 80, 70];
  return {
    title: { text: params.title || '柱状图示例' },
    tooltip: { trigger: 'axis' },
    xAxis: { type: 'category', data: labels },
    yAxis: { type: 'value' },
    series: [
      {
        type: 'bar',
        data: values,
        itemStyle: { borderRadius: [4, 4, 0, 0] },
      },
    ],
  };
}`;

export const defaultChartRadarScript = `async function generateChartOption(context) {
  const { params } = context;
  return {
    title: { text: params.title || '雷达图示例' },
    legend: { data: ['预算', '实际'] },
    radar: {
      indicator: [
        { name: '销售', max: 6500 },
        { name: '管理', max: 16000 },
        { name: '信息技术', max: 30000 },
        { name: '客服', max: 38000 },
        { name: '研发', max: 52000 },
        { name: '市场', max: 25000 },
      ],
    },
    series: [
      {
        type: 'radar',
        data: [
          { value: [4200, 3000, 20000, 35000, 50000, 18000], name: '预算' },
          { value: [5000, 14000, 28000, 26000, 42000, 21000], name: '实际' },
        ],
      },
    ],
  };
}`;
