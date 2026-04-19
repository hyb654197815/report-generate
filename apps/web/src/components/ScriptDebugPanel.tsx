import { BugOutlined } from '@ant-design/icons';
import { useMutation } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Alert, Button, Input, Space, Typography } from 'antd';
import { api } from '../api';

type DebugOkObject = { ok: true; kind: 'object'; result: Record<string, unknown> };
type DebugOkB64 = {
  ok: true;
  kind: 'base64';
  result: string;
  preview: string;
  length: number;
};
type DebugErr = { ok: false; message: string; name?: string; stack?: string };

type DebugResponse = DebugOkObject | DebugOkB64 | DebugErr;

const defaultParamsText = `{
  "title": "调试标题",
  "body": "调试正文"
}`;

export type ScriptDebugPanelProps = {
  elementType: 'TEXT' | 'IMAGE';
  script: string;
};

export function ScriptDebugPanel({ elementType, script }: ScriptDebugPanelProps) {
  const [paramsText, setParamsText] = useState(defaultParamsText);
  const [last, setLast] = useState<DebugResponse | null>(null);

  const trimmed = script?.trim() ?? '';
  const canRun = trimmed.length > 0;

  const debugM = useMutation({
    mutationFn: async () => {
      let params: Record<string, unknown> = {};
      try {
        const parsed: unknown = JSON.parse(paramsText || '{}');
        if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
          throw new Error('params 必须是 JSON 对象，例如 {"title":"x"}');
        }
        params = parsed as Record<string, unknown>;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        throw new Error(`参数 JSON 无效：${msg}`);
      }
      const res = await api.post<DebugResponse>('/scripts/debug', {
        elementType,
        script,
        params,
      });
      return res.data;
    },
    onSuccess: (data) => {
      setLast(data);
    },
    onError: (e: unknown) => {
      const ex = e as Error & { response?: { data?: { message?: string | string[] } } };
      if (!ex.response) {
        setLast({ ok: false, message: ex.message || String(e), name: ex.name });
        return;
      }
      const raw = ex.response.data?.message;
      const message = Array.isArray(raw) ? raw.join('；') : raw ?? ex.message ?? '请求失败';
      setLast({ ok: false, message: String(message), name: 'HTTP' });
    },
  });

  const resultBlock = useMemo(() => {
    if (!last) {
      return null;
    }
    if (!last.ok) {
      return (
        <Alert
          type="error"
          showIcon
          message={last.name ? `${last.name}: ${last.message}` : last.message}
          description={
            last.stack ? (
              <pre
                style={{
                  margin: 0,
                  marginTop: 8,
                  maxHeight: 220,
                  overflow: 'auto',
                  fontSize: 12,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
              >
                {last.stack}
              </pre>
            ) : undefined
          }
        />
      );
    }
    if (last.kind === 'object') {
      return (
        <Alert
          type="success"
          showIcon
          message="fetchData 执行成功"
          description={
            <pre
              style={{
                margin: 0,
                marginTop: 8,
                maxHeight: 280,
                overflow: 'auto',
                fontSize: 12,
              }}
            >
              {JSON.stringify(last.result, null, 2)}
            </pre>
          }
        />
      );
    }
    return (
      <Alert
        type="success"
        showIcon
        message={`generateChart 成功（Base64 长度 ${last.length}）`}
        description={
          <div>
            <Typography.Paragraph type="secondary" style={{ marginBottom: 8, fontSize: 12 }}>
              预览（前 160 字符）：
            </Typography.Paragraph>
            <pre
              style={{
                margin: 0,
                maxHeight: 120,
                overflow: 'auto',
                fontSize: 11,
                wordBreak: 'break-all',
              }}
            >
              {last.preview}
            </pre>
          </div>
        }
      />
    );
  }, [last]);

  return (
    <div style={{ marginTop: 16 }}>
      <Typography.Text strong style={{ display: 'block', marginBottom: 8 }}>
        脚本调试
      </Typography.Text>
      <Typography.Paragraph type="secondary" style={{ fontSize: 12, marginBottom: 8 }}>
        使用与报告生成相同的沙箱（http 白名单、AI、超时等）。TEXT 校验返回值为可 JSON 序列化的对象；IMAGE 校验非空 Base64。
      </Typography.Paragraph>
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        <div>
          <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
            模拟 params（JSON 对象）
          </Typography.Text>
          <Input.TextArea
            rows={5}
            value={paramsText}
            onChange={(e) => setParamsText(e.target.value)}
            style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12 }}
            placeholder='{"title":"..."}'
          />
        </div>
        <Button
          type="primary"
          ghost
          icon={<BugOutlined />}
          loading={debugM.isPending}
          disabled={!canRun}
          onClick={() => debugM.mutate()}
        >
          运行调试
        </Button>
        {resultBlock}
      </Space>
    </div>
  );
}
