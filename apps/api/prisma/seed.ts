import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const defaultFetchData = `async function fetchData(context) {
  const { params } = context;
  return { title: params.title || '示例标题', body: '这是一段示例正文。' };
}`;

const defaultGenerateChart = `async function generateChart(context) {
  return '';
}`;

async function main() {
  await prisma.aiSettings.upsert({
    where: { id: 1 },
    create: {
      id: 1,
      baseUrl: 'https://api.openai.com/v1',
      chatModel: 'gpt-4o-mini',
      imageModel: 'gpt-image-1',
      mockEnabled: false,
      apiKey: null,
    },
    update: {},
  });

  const existing = await prisma.sysComponent.count();
  if (existing > 0) {
    return;
  }
  await prisma.sysComponent.createMany({
    data: [
      {
        name: '示例文本组件',
        type: 'TEXT',
        defaultScript: defaultFetchData,
        defaultConfig: JSON.stringify({
          richHtml:
            '<p><strong>{{title}}</strong></p><p>{{body}}</p>',
        }),
      },
      {
        name: '示例图片组件',
        type: 'IMAGE',
        defaultScript: defaultGenerateChart,
        defaultConfig: JSON.stringify({
          placeholderUrl: 'https://via.placeholder.com/400x200.png?text=Chart',
        }),
      },
    ],
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
