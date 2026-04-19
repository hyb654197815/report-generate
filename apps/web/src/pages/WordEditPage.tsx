import { ArrowLeftOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { App, Alert, Button, Card, Result, Spin, Typography } from 'antd';
import { useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Quill from 'quill';
import 'quill/dist/quill.snow.css';
import { api } from '../api';

export function WordEditPage() {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const { id } = useParams();
  const templateId = Number(id);
  const editorRef = useRef<HTMLDivElement | null>(null);
  const quillRef = useRef<Quill | null>(null);
  const qc = useQueryClient();

  const draft = useQuery({
    queryKey: ['draft', templateId],
    queryFn: async () => {
      const res = await api.get(`/templates/${templateId}/draft-html`, {
        responseType: 'text',
        transformResponse: [(d) => d],
      });
      return res.data as string;
    },
    enabled: Number.isFinite(templateId),
  });

  useEffect(() => {
    const host = editorRef.current;
    if (!host || quillRef.current || !draft.data) {
      return;
    }
    const q = new Quill(host, { theme: 'snow' });
    q.clipboard.dangerouslyPasteHTML(draft.data);
    quillRef.current = q;
    return () => {
      quillRef.current = null;
      host.innerHTML = '';
    };
  }, [draft.data]);

  const renderPdf = useMutation({
    mutationFn: async () => {
      const html = quillRef.current?.root.innerHTML ?? '';
      await api.post(`/templates/${templateId}/render-background`, { html });
    },
    onSuccess: async () => {
      message.success('底图 PDF 已生成');
      await qc.invalidateQueries({ queryKey: ['template', templateId] });
      navigate(`/templates/${templateId}/design`);
    },
    onError: () => {
      message.error('生成失败，请重试');
    },
  });

  if (!Number.isFinite(templateId)) {
    return <Result status="404" title="无效的模板 ID" />;
  }
  if (draft.isLoading) {
    return (
      <div style={{ textAlign: 'center', padding: 48 }}>
        <Spin size="large" tip="加载草稿…" />
      </div>
    );
  }
  if (draft.isError) {
    return (
      <Result
        status="warning"
        title="无法加载草稿"
        subTitle="可能尚未上传 Word，或草稿不存在。"
        extra={
          <Button type="primary" onClick={() => navigate(`/templates/${templateId}`)}>
            返回模板详情
          </Button>
        }
      />
    );
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
        编辑 Word 转换的 HTML
      </Typography.Title>
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16, maxWidth: 800 }}
        message="确认内容后，将使用 Gotenberg 将 HTML 转为底图 PDF，然后可进入设计器框选动态区域。"
      />
      <Card styles={{ body: { padding: 0 } }}>
        <div style={{ padding: '0 16px 16px' }}>
          <div ref={editorRef} style={{ minHeight: 360 }} />
        </div>
      </Card>
      <Button
        type="primary"
        style={{ marginTop: 16 }}
        loading={renderPdf.isPending}
        onClick={() => renderPdf.mutate()}
      >
        生成底图 PDF
      </Button>
    </div>
  );
}
