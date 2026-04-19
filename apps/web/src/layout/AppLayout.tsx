import {
  AppstoreOutlined,
  BlockOutlined,
  FileAddOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import { Breadcrumb, Layout, Menu, theme } from 'antd';
import { useMemo } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';

const { Header, Sider, Content } = Layout;

function breadcrumbForPath(pathname: string) {
  if (pathname === '/') {
    return [{ title: '模板列表' }];
  }
  if (pathname === '/components') {
    return [{ title: <Link to="/">模板列表</Link> }, { title: '公共组件库' }];
  }
  if (pathname === '/settings/ai') {
    return [{ title: <Link to="/">模板列表</Link> }, { title: '大模型设置' }];
  }
  if (pathname === '/templates/new') {
    return [
      { title: <Link to="/">模板列表</Link> },
      { title: '新建模板' },
    ];
  }
  const m = pathname.match(/^\/templates\/(\d+)(?:\/(.*))?$/);
  if (m) {
    const id = m[1];
    const sub = m[2];
    const base = { title: <Link to={`/templates/${id}`}>模板 #{id}</Link> };
    if (!sub) {
      return [{ title: <Link to="/">模板列表</Link> }, { title: `模板 #${id}` }];
    }
    const subTitle =
      sub === 'word'
        ? 'Word 编辑'
        : sub === 'design'
          ? '设计器'
          : sub === 'generate'
            ? '生成报告'
            : sub;
    return [
      { title: <Link to="/">模板列表</Link> },
      base,
      { title: subTitle },
    ];
  }
  return [{ title: <Link to="/">模板列表</Link> }];
}

export function AppLayout() {
  const location = useLocation();
  const { token } = theme.useToken();

  const selectedKeys = useMemo(() => {
    if (location.pathname === '/components') {
      return ['components'];
    }
    if (location.pathname === '/settings/ai') {
      return ['ai-settings'];
    }
    if (location.pathname === '/templates/new') {
      return ['new'];
    }
    return ['templates'];
  }, [location.pathname]);

  const breadcrumbItems = useMemo(
    () => breadcrumbForPath(location.pathname),
    [location.pathname],
  );

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        breakpoint="lg"
        collapsible
        theme="light"
        width={232}
        style={{ borderRight: `1px solid ${token.colorBorderSecondary}` }}
      >
        <div
          style={{
            padding: '20px 16px',
            fontWeight: 600,
            fontSize: 15,
            borderBottom: `1px solid ${token.colorBorderSecondary}`,
          }}
        >
          报告生成平台
        </div>
        <Menu
          mode="inline"
          selectedKeys={selectedKeys}
          style={{ borderInlineEnd: 0, paddingTop: 8 }}
          items={[
            {
              key: 'templates',
              icon: <AppstoreOutlined />,
              label: <Link to="/">模板列表</Link>,
            },
            {
              key: 'components',
              icon: <BlockOutlined />,
              label: <Link to="/components">公共组件库</Link>,
            },
            {
              key: 'ai-settings',
              icon: <SettingOutlined />,
              label: <Link to="/settings/ai">大模型设置</Link>,
            },
            {
              key: 'new',
              icon: <FileAddOutlined />,
              label: <Link to="/templates/new">新建模板</Link>,
            },
          ]}
        />
      </Sider>
      <Layout>
        <Header
          style={{
            padding: '0 24px',
            background: token.colorBgContainer,
            height: 56,
            lineHeight: '56px',
            borderBottom: `1px solid ${token.colorBorderSecondary}`,
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <Breadcrumb items={breadcrumbItems} />
        </Header>
        <Content
          style={{
            margin: 24,
            padding: 24,
            minHeight: 280,
            background: token.colorBgContainer,
            borderRadius: token.borderRadiusLG,
          }}
        >
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
