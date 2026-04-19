import { ArrowLeftOutlined, DownloadOutlined } from '@ant-design/icons';
import { useMutation } from '@tanstack/react-query';
import { App, Button, Card, Form, Input, Result, Typography } from 'antd';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';

const defaultJson = '{\n  "title": "演示标题"\n}';

export function GeneratePage() {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const { id } = useParams();
  const templateId = Number(id);
  const [json, setJson] = useState(defaultJson);

  const gen = useMutation({
    mutationFn: async () => {
      let params: Record<string, unknown>;
      try {
        params = JSON.parse(json) as Record<string, unknown>;
      } catch {
        throw new Error('Invalid JSON');
      }
      const res = await api.post(
        '/reports/generate',
        { templateId, params },
        { responseType: 'blob' },
      );
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `report-${templateId}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    },
    onSuccess: () => {
      message.success('已开始下载 PDF');
    },
    onError: (err: Error) => {
      if (err.message === 'Invalid JSON') {
        message.error('JSON 格式不正确');
      } else {
        message.error('生成失败，请检查参数与模板元素');
      }
    },
  });

  if (!Number.isFinite(templateId)) {
    return <Result status="404" title="无效的模板 ID" />;
  }

  return (
    <div>
      <Typography.Paragraph style={{ marginBottom: 16 }}>
        <Button
          type="link"
          icon={<ArrowLeftOutlined />}
          style={{ paddingLeft: 0 }}
          onClick={() => navigate(`/templates/${templateId}`)}
        >
          模板详情
        </Button>
      </Typography.Paragraph>
      <Typography.Title level={4} style={{ marginTop: 0 }}>
        生成报告
      </Typography.Title>
      <Typography.Paragraph type="secondary">
        以下 JSON 会作为脚本中的 <Typography.Text code>params</Typography.Text>{' '}
        传入后端。
      </Typography.Paragraph>
      <Card style={{ maxWidth: 720 }}>
        <Form layout="vertical">
          <Form.Item
            label="参数 JSON"
            validateStatus={gen.isError ? 'error' : undefined}
          >
            <Input.TextArea
              rows={12}
              value={json}
              onChange={(e) => setJson(e.target.value)}
              style={{ fontFamily: 'ui-monospace, monospace' }}
            />
          </Form.Item>
          <Form.Item>
            <Button
              type="primary"
              icon={<DownloadOutlined />}
              loading={gen.isPending}
              onClick={() => gen.mutate()}
            >
              下载 PDF
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}
