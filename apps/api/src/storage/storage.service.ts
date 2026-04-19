import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { loadEnv } from '../config/env.schema';

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private client!: S3Client;
  private bucket!: string;

  async onModuleInit() {
    const env = loadEnv();
    this.bucket = env.minio.bucket;
    this.client = new S3Client({
      region: 'us-east-1',
      endpoint: `${env.minio.useSsl ? 'https' : 'http'}://${env.minio.endpoint}:${env.minio.port}`,
      forcePathStyle: true,
      credentials: {
        accessKeyId: env.minio.accessKey,
        secretAccessKey: env.minio.secretKey,
      },
    });
    await this.ensureBucket();
  }

  private async ensureBucket() {
    try {
      await this.client.send(
        new CreateBucketCommand({ Bucket: this.bucket }),
      );
    } catch (e) {
      const name = (e as { name?: string }).name;
      const code = (e as { Code?: string }).Code;
      if (
        name !== 'BucketAlreadyOwnedByYou' &&
        code !== 'BucketAlreadyOwnedByYou' &&
        code !== 'BucketAlreadyExists'
      ) {
        this.logger.warn(`Bucket create: ${(e as Error).message}`);
      }
    }
  }

  objectKeyToUrl(key: string) {
    const env = loadEnv();
    const proto = env.minio.useSsl ? 'https' : 'http';
    return `${proto}://${env.minio.endpoint}:${env.minio.port}/${this.bucket}/${key}`;
  }

  async putObject(
    key: string,
    body: Buffer,
    contentType: string,
  ): Promise<string> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
    return key;
  }

  async getObjectBuffer(key: string): Promise<Buffer> {
    const res = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
    );
    const stream = res.Body as AsyncIterable<Uint8Array>;
    const chunks: Uint8Array[] = [];
    for await (const c of stream) {
      chunks.push(c);
    }
    return Buffer.concat(chunks);
  }

  async deleteObject(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    );
  }
}
