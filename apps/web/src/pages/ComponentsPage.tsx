import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons';
import Editor from '@monaco-editor/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import {
  App,
  Button,
  Card,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { HtmlQuillEditor } from '../components/HtmlQuillEditor';
import { ScriptDebugPanel } from '../components/ScriptDebugPanel';
import { api } from '../api';

type SysComponent = {
  id: number;
  name: string;
  type: string;
  defaultScript: string | null;
  defaultConfig: string | null;
};

const defaultTextScript = `async function fetchData(context) {
  const { params } = context;
  return { title: params.title || '示例标题' };
}`;

const defaultImageScript = `async function generateChart(context) {
  // 返回 PNG/JPEG 的 Base64（不含 data:image 前缀）
  return '';
}`;

const defaultRichHtml =
  '<p><strong>{{title}}</strong></p><p>在此编辑说明文字，可使用工具栏调整样式。</p>';

type CreateComponentForm = {
  name: string;
  type: 'TEXT' | 'IMAGE';
  defaultScript?: string;
};

export function ComponentsPage() {
  const { message } = App.useApp();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  /** `null` = 新建；否则为正在编辑的组件 id */
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form] = Form.useForm<CreateComponentForm>();
  const componentType = Form.useWatch('type', form) as 'TEXT' | 'IMAGE' | undefined;

  const [editorSession, setEditorSession] = useState(0);
  const [richHtml, setRichHtml] = useState(defaultRichHtml);
  const [placeholderUrl, setPlaceholderUrl] = useState(
    'https://via.placeholder.com/400x200.png',
  );

  const listQ = useQuery({
    queryKey: ['components'],
    queryFn: async () => {
      const res = await api.get<SysComponent[]>('/components');
      return res.data;
    },
  });

  useEffect(() => {
    if (!open) {
      return;
    }
    if (editingId === null) {
      form.setFieldsValue({
        name: '',
        type: 'TEXT',
        defaultScript: defaultTextScript,
      });
      setRichHtml(defaultRichHtml);
      setPlaceholderUrl('https://via.placeholder.com/400x200.png');
      setEditorSession((s) => s + 1);
      return;
    }
    const c = listQ.data?.find((x) => x.id === editingId);
    if (!c) {
      return;
    }
    const t = c.type === 'IMAGE' ? 'IMAGE' : 'TEXT';
    form.setFieldsValue({
      name: c.name,
      type: t,
      defaultScript: c.defaultScript ?? (t === 'TEXT' ? defaultTextScript : defaultImageScript),
    });
    let rich = defaultRichHtml;
    let placeholder = 'https://via.placeholder.com/400x200.png';
    if (c.defaultConfig) {
      try {
        const cfg = JSON.parse(c.defaultConfig) as {
          richHtml?: string;
          placeholderUrl?: string;
        };
        if (typeof cfg.richHtml === 'string') {
          rich = cfg.richHtml;
        }
        if (typeof cfg.placeholderUrl === 'string') {
          placeholder = cfg.placeholderUrl;
        }
      } catch {
        // keep defaults
      }
    }
    setRichHtml(rich);
    setPlaceholderUrl(placeholder);
    setEditorSession((s) => s + 1);
  }, [open, editingId, form, listQ.data]);

  const createM = useMutation({
    mutationFn: async (values: {
      name: string;
      type: 'TEXT' | 'IMAGE';
      defaultScript?: string;
      defaultConfig?: string;
    }) => {
      await api.post('/components', values);
    },
    onSuccess: async () => {
      message.success('组件已创建');
      setOpen(false);
      setEditingId(null);
      form.resetFields();
      await qc.invalidateQueries({ queryKey: ['components'] });
    },
    onError: () => {
      message.error('创建失败，请检查表单内容');
    },
  });

  const updateM = useMutation({
    mutationFn: async (payload: {
      id: number;
      name: string;
      type: 'TEXT' | 'IMAGE';
      defaultScript?: string;
      defaultConfig?: string;
    }) => {
      const { id, ...body } = payload;
      await api.patch(`/components/${id}`, body);
    },
    onSuccess: async () => {
      message.success('组件已更新');
      setOpen(false);
      setEditingId(null);
      form.resetFields();
      await qc.invalidateQueries({ queryKey: ['components'] });
    },
    onError: () => {
      message.error('更新失败，请检查表单内容');
    },
  });

  const deleteM = useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/components/${id}`);
    },
    onSuccess: async () => {
      message.success('组件已删除');
      await qc.invalidateQueries({ queryKey: ['components'] });
    },
    onError: () => {
      message.error('删除失败');
    },
  });

  const columns: ColumnsType<SysComponent> = [
    { title: 'ID', dataIndex: 'id', width: 72 },
    { title: '名称', dataIndex: 'name' },
    { title: '类型', dataIndex: 'type', width: 96 },
    {
      title: '默认脚本',
      dataIndex: 'defaultScript',
      ellipsis: true,
      render: (v: string | null) => (
        <Typography.Text type="secondary" ellipsis>
          {v ? `${v.slice(0, 80)}${v.length > 80 ? '…' : ''}` : '—'}
        </Typography.Text>
      ),
    },
    {
      title: '操作',
      key: 'actions',
      width: 168,
      render: (_, record) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => {
              setEditingId(record.id);
              setOpen(true);
            }}
          >
            编辑
          </Button>
          <Popconfirm
            title="确定删除该组件？"
            description="模板中引用该组件的区域将变为未关联组件。"
            okText="删除"
            cancelText="取消"
            okButtonProps={{ danger: true }}
            onConfirm={() => deleteM.mutate(record.id)}
          >
            <Button type="link" size="small" danger icon={<DeleteOutlined />} loading={deleteM.isPending}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Card
        size="small"
        title="公共组件库"
        extra={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              setEditingId(null);
              setOpen(true);
            }}
          >
            新建组件
          </Button>
        }
        style={{ marginBottom: 16 }}
      >
        <Typography.Paragraph type="secondary" style={{ marginBottom: 16 }}>
          TEXT 类型使用富文本编辑默认 HTML（存于 defaultConfig.richHtml）；IMAGE 类型填写占位图地址（placeholderUrl）。
        </Typography.Paragraph>
        <Table<SysComponent>
          rowKey="id"
          loading={listQ.isLoading}
          dataSource={listQ.data ?? []}
          columns={columns}
          pagination={{ pageSize: 10 }}
        />
      </Card>

      <Modal
        title={editingId === null ? '新建公共组件' : '编辑公共组件'}
        open={open}
        onCancel={() => {
          setOpen(false);
          setEditingId(null);
        }}
        footer={null}
        destroyOnClose
        width={820}
        styles={{ body: { paddingTop: 8 } }}
      >
        <Form
          form={form}
          layout="vertical"
          size="large"
          initialValues={{ type: 'TEXT' as const }}
          onFinish={(v) => {
            const defaultConfig =
              v.type === 'TEXT'
                ? JSON.stringify({ richHtml: richHtml })
                : JSON.stringify({ placeholderUrl: placeholderUrl.trim() });
            try {
              JSON.parse(defaultConfig);
            } catch {
              message.error('配置序列化失败');
              return;
            }
            const payload = {
              name: v.name.trim(),
              type: v.type,
              defaultScript: v.defaultScript?.trim() || undefined,
              defaultConfig,
            };
            if (editingId === null) {
              createM.mutate(payload);
            } else {
              updateM.mutate({ id: editingId, ...payload });
            }
          }}
        >
          <Form.Item
            name="name"
            label="组件名称"
            rules={[{ required: true, message: '请输入名称' }]}
          >
            <Input placeholder="例如：销售摘要文本块" />
          </Form.Item>
          <Form.Item name="type" label="类型" rules={[{ required: true }]}>
            <Select
              options={[
                { value: 'TEXT', label: 'TEXT（富文本 + fetchData）' },
                { value: 'IMAGE', label: 'IMAGE（generateChart 出图）' },
              ]}
              onChange={(t: 'TEXT' | 'IMAGE') => {
                form.setFieldsValue({
                  defaultScript: t === 'TEXT' ? defaultTextScript : defaultImageScript,
                });
                if (t === 'TEXT') {
                  setRichHtml('<p>{{title}}</p>');
                } else {
                  setPlaceholderUrl('https://via.placeholder.com/400x200.png');
                }
                setEditorSession((s) => s + 1);
              }}
            />
          </Form.Item>
          <Form.Item shouldUpdate noStyle>
            {() => {
              const t = form.getFieldValue('type') as 'TEXT' | 'IMAGE' | undefined;
              const sc = (form.getFieldValue('defaultScript') as string) ?? '';
              return (
                <Form.Item name="defaultScript" label="默认脚本（fetchData / generateChart）">
                  <div style={{ border: '1px solid #f0f0f0', borderRadius: 6, overflow: 'hidden' }}>
                    <Editor
                      height="220px"
                      defaultLanguage="javascript"
                      path="component-default.js"
                      options={{ minimap: { enabled: false }, wordWrap: 'on' }}
                      value={sc}
                      onChange={(val) => form.setFieldValue('defaultScript', val ?? '')}
                    />
                  </div>
                  {t ? <ScriptDebugPanel key={`cmp-dbg-${editorSession}-${t}`} elementType={t} script={sc} /> : null}
                </Form.Item>
              );
            }}
          </Form.Item>

          {componentType === 'IMAGE' ? (
            <Form.Item label="占位图 URL（defaultConfig.placeholderUrl）">
              <Input
                size="large"
                value={placeholderUrl}
                onChange={(e) => setPlaceholderUrl(e.target.value)}
                placeholder="https://…"
              />
            </Form.Item>
          ) : (
            <Form.Item label="默认富文本（defaultConfig.richHtml）">
              <Typography.Paragraph type="secondary" style={{ marginBottom: 8, fontSize: 13 }}>
                使用工具栏设置标题、加粗、颜色等；{' '}
                <Typography.Text code>{'{{title}}'}</Typography.Text> 等占位符与脚本返回字段对应。
              </Typography.Paragraph>
              <div
                style={{
                  border: '1px solid #f0f0f0',
                  borderRadius: 8,
                  overflow: 'hidden',
                  background: '#fff',
                }}
              >
                <HtmlQuillEditor
                  instanceKey={`modal-${editorSession}`}
                  initialHtml={richHtml}
                  minHeight={300}
                  onHtmlChange={setRichHtml}
                />
              </div>
            </Form.Item>
          )}

          <Form.Item style={{ marginBottom: 0, marginTop: 8 }}>
            <Space size="middle">
              <Button
                type="primary"
                htmlType="submit"
                size="large"
                loading={editingId === null ? createM.isPending : updateM.isPending}
              >
                {editingId === null ? '创建组件' : '保存修改'}
              </Button>
              <Button
                size="large"
                onClick={() => {
                  setOpen(false);
                  setEditingId(null);
                }}
              >
                取消
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
