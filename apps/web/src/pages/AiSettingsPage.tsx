import { ThunderboltOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import {
  Alert,
  App,
  Button,
  Card,
  Flex,
  Form,
  Input,
  Space,
  Switch,
  Typography,
} from 'antd';
import { api } from '../api';

type PublicAiSettings = {
  baseUrl: string;
  chatModel: string;
  imageModel: string;
  mockEnabled: boolean;
  hasApiKey: boolean;
};

type FormValues = {
  baseUrl: string;
  chatModel: string;
  imageModel: string;
  mockEnabled: boolean;
  apiKey?: string;
};

export function AiSettingsPage() {
  const { message } = App.useApp();
  const qc = useQueryClient();
  const [form] = Form.useForm<FormValues>();
  const [lastTestReply, setLastTestReply] = useState<string | null>(null);
  const [testPrompt, setTestPrompt] = useState('用一句话回复：连接成功。');

  const settingsQ = useQuery({
    queryKey: ['ai-settings'],
    queryFn: async () => {
      const res = await api.get<PublicAiSettings>('/ai-settings');
      return res.data;
    },
  });

  useEffect(() => {
    const d = settingsQ.data;
    if (!d) {
      return;
    }
    form.setFieldsValue({
      baseUrl: d.baseUrl,
      chatModel: d.chatModel,
      imageModel: d.imageModel,
      mockEnabled: d.mockEnabled,
      apiKey: '',
    });
  }, [settingsQ.data, form]);

  const saveM = useMutation({
    mutationFn: async (v: FormValues) => {
      const payload: Record<string, unknown> = {
        baseUrl: v.baseUrl.trim(),
        chatModel: v.chatModel.trim(),
        imageModel: v.imageModel.trim(),
        mockEnabled: v.mockEnabled,
      };
      if (v.apiKey && v.apiKey.trim()) {
        payload.apiKey = v.apiKey.trim();
      }
      const res = await api.put<PublicAiSettings>('/ai-settings', payload);
      return res.data;
    },
    onSuccess: async () => {
      message.success('已保存');
      form.setFieldValue('apiKey', '');
      await qc.invalidateQueries({ queryKey: ['ai-settings'] });
    },
    onError: () => message.error('保存失败'),
  });

  const testM = useMutation({
    mutationFn: async (payload: { prompt: string; form: FormValues }) => {
      const { prompt, form: v } = payload;
      const res = await api.post<{ reply: string }>('/ai-settings/test-chat', {
        prompt: prompt.trim() || undefined,
        baseUrl: v.baseUrl,
        chatModel: v.chatModel,
        mockEnabled: v.mockEnabled,
        apiKey: v.apiKey?.trim() ? v.apiKey.trim() : undefined,
      });
      return res.data.reply;
    },
    onSuccess: (reply) => {
      setLastTestReply(reply);
      message.success('模型已响应');
    },
    onError: () => message.error('调用失败，请检查 Base URL、模型与 Key'),
  });

  return (
    <div style={{ maxWidth: 720 }}>
      <Flex vertical gap={16}>
        <div>
          <Typography.Title level={4} style={{ margin: 0 }}>
            大模型（OpenAI 兼容）
          </Typography.Title>
          <Typography.Paragraph type="secondary" style={{ marginBottom: 0, marginTop: 8 }}>
            使用与 OpenAI 相同的 REST：<Typography.Text code>/v1/chat/completions</Typography.Text> 与{' '}
            <Typography.Text code>/v1/images/generations</Typography.Text>
            。Base URL 填到 <Typography.Text code>/v1</Typography.Text> 为止（不要带 chat/completions）。
            未配置 API Key 或开启「模拟模式」时，脚本中的 AI 返回 mock 结果。
          </Typography.Paragraph>
        </div>

        <Card>
          <Form<FormValues>
            form={form}
            layout="vertical"
            size="large"
            onFinish={(v) => saveM.mutate(v)}
            disabled={settingsQ.isLoading}
          >
            <Form.Item
              name="baseUrl"
              label="Base URL"
              rules={[{ required: true, message: '请输入 Base URL' }]}
              extra="例如 https://api.openai.com/v1 或兼容网关"
            >
              <Input placeholder="https://api.openai.com/v1" autoComplete="off" />
            </Form.Item>
            <Form.Item
              name="chatModel"
              label="对话模型（chat/completions）"
              rules={[{ required: true, message: '请输入模型名' }]}
            >
              <Input placeholder="gpt-4o-mini" autoComplete="off" />
            </Form.Item>
            <Form.Item
              name="imageModel"
              label="生图模型（images/generations）"
              rules={[{ required: true, message: '请输入模型名' }]}
            >
              <Input placeholder="gpt-image-1" autoComplete="off" />
            </Form.Item>
            <Form.Item name="mockEnabled" label="模拟模式（不请求真实模型）" valuePropName="checked">
              <Switch />
            </Form.Item>
            <Form.Item
              name="apiKey"
              label="API Key"
              extra={
                settingsQ.data?.hasApiKey
                  ? '已保存过 Key：留空并点保存不会清除；填写新值会覆盖。'
                  : '可选；也可仅依赖环境变量 OPENAI_API_KEY。'
              }
            >
              <Input.Password placeholder="sk-…" autoComplete="new-password" />
            </Form.Item>

            <Alert
              type="info"
              showIcon
              style={{ marginBottom: 20 }}
              message={
                settingsQ.data?.hasApiKey
                  ? '当前已检测到 API Key（数据库或环境变量）。'
                  : '当前未检测到 API Key。'
              }
            />

            <Form.Item
              label="连通性测试"
              extra="使用当前表单中的 Base URL、模型、模拟开关与 Key（未填 Key 则用已保存或环境变量）。无需先点保存。"
            >
              <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                <Input.TextArea
                  rows={3}
                  placeholder="测试提示词"
                  value={testPrompt}
                  onChange={(e) => setTestPrompt(e.target.value)}
                />
                <Button
                  size="large"
                  type="default"
                  icon={<ThunderboltOutlined />}
                  loading={testM.isPending}
                  onClick={() => {
                    const v = form.getFieldsValue();
                    void testM.mutateAsync({ prompt: testPrompt, form: v });
                  }}
                >
                  测试对话
                </Button>
              </Space>
            </Form.Item>

            <Form.Item>
              <Space size="middle" wrap>
                <Button type="primary" htmlType="submit" size="large" loading={saveM.isPending}>
                  保存设置
                </Button>
              </Space>
            </Form.Item>
          </Form>

          {lastTestReply != null && (
            <Card size="small" title="最近一次测试回复" style={{ marginTop: 16 }}>
              <Typography.Paragraph style={{ whiteSpace: 'pre-wrap', margin: 0 }}>
                {lastTestReply}
              </Typography.Paragraph>
            </Card>
          )}
        </Card>
      </Flex>
    </div>
  );
}
