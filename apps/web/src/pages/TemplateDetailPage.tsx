import {
  ArrowLeftOutlined,
  EditOutlined,
  FileTextOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import {
  Button,
  Descriptions,
  Result,
  Space,
  Spin,
  Tag,
  Typography,
} from 'antd';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';

export function TemplateDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const templateId = Number(id);
  const q = useQuery({
    queryKey: ['template', templateId],
    queryFn: async () => {
      const res = await api.get(`/templates/${templateId}`);
      return res.data;
    },
    enabled: Number.isFinite(templateId),
  });

  if (!Number.isFinite(templateId)) {
    return <Result status="404" title="无效的模板 ID" />;
  }
  if (q.isLoading) {
    return (
      <div style={{ textAlign: 'center', padding: 48 }}>
        <Spin size="large" />
      </div>
    );
  }
  if (q.isError) {
    return (
      <Result
        status="error"
        title="加载失败"
        extra={
          <Button type="primary" onClick={() => navigate('/')}>
            返回列表
          </Button>
        }
      />
    );
  }

  const t = q.data as {
    id: number;
    name: string;
    type: number;
    backgroundPdfUrl: string | null;
    draftHtmlUrl: string | null;
  };

  return (
    <div>
      <Typography.Paragraph style={{ marginBottom: 16 }}>
        <Button
          type="link"
          icon={<ArrowLeftOutlined />}
          style={{ paddingLeft: 0 }}
          onClick={() => navigate('/')}
        >
          模板列表
        </Button>
      </Typography.Paragraph>
      <Typography.Title level={4} style={{ marginTop: 0 }}>
        {t.name}
      </Typography.Title>
      <Descriptions bordered column={1} size="small" style={{ maxWidth: 560 }}>
        <Descriptions.Item label="模板 ID">{t.id}</Descriptions.Item>
        <Descriptions.Item label="类型">
          {t.type === 1 ? (
            <Tag color="blue">Word 导入</Tag>
          ) : (
            <Tag color="green">PDF 导入</Tag>
          )}
        </Descriptions.Item>
        <Descriptions.Item label="底图 PDF">
          {t.backgroundPdfUrl ? (
            <Tag color="success">已就绪</Tag>
          ) : (
            <Tag>未生成</Tag>
          )}
        </Descriptions.Item>
        <Descriptions.Item label="Word 草稿 HTML">
          {t.draftHtmlUrl ? <Tag>已保存</Tag> : <Tag>无</Tag>}
        </Descriptions.Item>
      </Descriptions>
      <Typography.Title level={5} style={{ marginTop: 24 }}>
        下一步
      </Typography.Title>
      <Space wrap>
        {t.type === 1 && t.draftHtmlUrl && !t.backgroundPdfUrl && (
          <Button
            type="primary"
            icon={<FileTextOutlined />}
            onClick={() => navigate(`/templates/${t.id}/word`)}
          >
            编辑 HTML 并生成底图 PDF
          </Button>
        )}
        {t.backgroundPdfUrl && (
          <Button
            type="primary"
            icon={<EditOutlined />}
            onClick={() => navigate(`/templates/${t.id}/design`)}
          >
            打开设计器
          </Button>
        )}
        {t.backgroundPdfUrl && (
          <Button
            icon={<ThunderboltOutlined />}
            onClick={() => navigate(`/templates/${t.id}/generate`)}
          >
            生成报告
          </Button>
        )}
      </Space>
    </div>
  );
}
