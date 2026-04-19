import { InboxOutlined } from '@ant-design/icons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { App, Button, Card, Form, Input, Typography, Upload } from 'antd';
import type { UploadFile } from 'antd/es/upload/interface';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api';

export function NewTemplatePage() {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [file, setFile] = useState<File | null>(null);
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const navigate = useNavigate();
  const qc = useQueryClient();

  const create = useMutation({
    mutationFn: async (values: { name: string }) => {
      const res = await api.post('/templates', { name: values.name });
      const id = res.data.id as number;
      if (file) {
        const fd = new FormData();
        fd.append('file', file);
        await api.post(`/templates/${id}/background`, fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      }
      return id;
    },
    onSuccess: async (id) => {
      message.success('模板已创建');
      await qc.invalidateQueries({ queryKey: ['templates'] });
      const detail = await api.get(`/templates/${id}`);
      const t = detail.data as { type: number; backgroundPdfUrl: string | null };
      if (t.type === 1 && !t.backgroundPdfUrl) {
        navigate(`/templates/${id}/word`);
      } else {
        navigate(`/templates/${id}`);
      }
    },
    onError: () => {
      message.error('创建失败，请重试');
    },
  });

  return (
    <div>
      <Typography.Title level={4} style={{ marginTop: 0 }}>
        新建模板
      </Typography.Title>
      <Typography.Paragraph type="secondary">
        填写名称并可选上传 Word（.docx）或 PDF 作为底图。仅上传 Word
        时，将先进入 HTML 编辑与底图生成流程。
      </Typography.Paragraph>
      <Card style={{ maxWidth: 640 }}>
        <Form
          form={form}
          layout="vertical"
          initialValues={{ name: '新模板' }}
          onFinish={(v) => create.mutate(v)}
        >
          <Form.Item
            name="name"
            label="模板名称"
            rules={[{ required: true, message: '请输入名称' }]}
          >
            <Input placeholder="例如：月度销售报告" maxLength={120} />
          </Form.Item>
          <Form.Item label="底图文件（可选）">
            <Upload.Dragger
              accept=".docx,.pdf,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              maxCount={1}
              fileList={fileList}
              beforeUpload={(f) => {
                setFile(f);
                setFileList([
                  {
                    uid: '-1',
                    name: f.name,
                    status: 'done',
                  },
                ]);
                return false;
              }}
              onRemove={() => {
                setFile(null);
                setFileList([]);
              }}
            >
              <p className="ant-upload-drag-icon">
                <InboxOutlined />
              </p>
              <p className="ant-upload-text">点击或拖拽文件到此区域</p>
              <p className="ant-upload-hint">支持 .docx 与 PDF，单文件</p>
            </Upload.Dragger>
          </Form.Item>
          <Form.Item style={{ marginBottom: 0 }}>
            <Button
              type="primary"
              htmlType="submit"
              loading={create.isPending}
            >
              创建
            </Button>
          </Form.Item>
        </Form>
      </Card>
      <Typography.Paragraph style={{ marginTop: 16 }}>
        <Link to="/">返回模板列表</Link>
      </Typography.Paragraph>
    </div>
  );
}
