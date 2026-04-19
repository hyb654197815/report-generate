import { DeleteOutlined, EditOutlined, EyeOutlined, PlusOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { App, Button, Popconfirm, Result, Space, Spin, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api';

type Template = {
  id: number;
  name: string;
  type: number;
  backgroundPdfUrl: string | null;
};

export function TemplatesPage() {
  const { message } = App.useApp();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const q = useQuery({
    queryKey: ['templates'],
    queryFn: async () => {
      const res = await api.get<Template[]>('/templates');
      return res.data;
    },
  });

  const deleteM = useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/templates/${id}`);
    },
    onSuccess: async () => {
      message.success('模板已删除');
      await qc.invalidateQueries({ queryKey: ['templates'] });
    },
    onError: () => {
      message.error('删除失败，请稍后重试');
    },
  });

  const columns: ColumnsType<Template> = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      render: (name, record) => (
        <Link to={`/templates/${record.id}`}>{name}</Link>
      ),
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 100,
      render: (type: number) =>
        type === 1 ? <Tag color="blue">Word</Tag> : <Tag color="green">PDF</Tag>,
    },
    {
      title: '底图',
      key: 'bg',
      width: 120,
      render: (_, record) =>
        record.backgroundPdfUrl ? (
          <Tag color="success">已上传</Tag>
        ) : (
          <Tag>未就绪</Tag>
        ),
    },
    {
      title: '操作',
      key: 'actions',
      width: 360,
      render: (_, record) => (
        <Space size="small" wrap>
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => navigate(`/templates/${record.id}`)}
          >
            详情
          </Button>
          {record.backgroundPdfUrl ? (
            <>
              <Button
                type="link"
                size="small"
                icon={<EditOutlined />}
                onClick={() => navigate(`/templates/${record.id}/design`)}
              >
                设计器
              </Button>
              <Button
                type="link"
                size="small"
                onClick={() => navigate(`/templates/${record.id}/generate`)}
              >
                生成
              </Button>
            </>
          ) : null}
          <Popconfirm
            title="确定删除该模板？"
            description="将同时删除底图文件及模板内所有元素配置，且不可恢复。"
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

  if (q.isError) {
    return (
      <Result
        status="error"
        title="加载失败"
        subTitle="请检查网络或后端服务是否可用。"
      />
    );
  }

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: 24,
          flexWrap: 'wrap',
          gap: 16,
        }}
      >
        <div>
          <Typography.Title level={4} style={{ margin: 0 }}>
            报告模板
          </Typography.Title>
          <Typography.Text type="secondary">
            管理底图与动态区域，生成 PDF 报告
          </Typography.Text>
        </div>
        <Link to="/templates/new">
          <Button type="primary" icon={<PlusOutlined />}>
            新建模板
          </Button>
        </Link>
      </div>
      <Spin spinning={q.isLoading}>
        <Table<Template>
          rowKey="id"
          columns={columns}
          dataSource={q.data ?? []}
          pagination={{ pageSize: 10, showSizeChanger: true }}
          locale={{ emptyText: q.isLoading ? ' ' : '暂无模板' }}
        />
      </Spin>
    </div>
  );
}
