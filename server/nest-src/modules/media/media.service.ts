import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import * as crypto from 'crypto';

@Injectable()
export class MediaService {
  private s3: S3Client | null;
  private bucket: string;

  constructor(private readonly configService: ConfigService) {
    const awsConfig = this.configService.get('aws');
    if (awsConfig?.accessKeyId && awsConfig?.secretAccessKey) {
      this.s3 = new S3Client({
        region: awsConfig.region,
        credentials: {
          accessKeyId: awsConfig.accessKeyId,
          secretAccessKey: awsConfig.secretAccessKey,
        },
      });
      this.bucket = awsConfig.s3Bucket;
    } else {
      this.s3 = null;
      this.bucket = '';
    }
  }

  async uploadFile(file: Express.Multer.File, userId: string): Promise<{
    url: string;
    key: string;
    size: number;
    mimeType: string;
  }> {
    if (!this.s3) {
      throw new BadRequestException('S3 not configured');
    }

    const key = `uploads/${userId}/${crypto.randomUUID()}-${file.originalname}`;

    await this.s3.send(new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
    }));

    const region = this.configService.get<string>('aws.region');
    const url = `https://${this.bucket}.s3.${region}.amazonaws.com/${key}`;

    return {
      url,
      key,
      size: file.size,
      mimeType: file.mimetype,
    };
  }

  async getSignedUploadUrl(filename: string, userId: string): Promise<{
    uploadUrl: string;
    key: string;
  }> {
    if (!this.s3) {
      throw new BadRequestException('S3 not configured');
    }

    const key = `uploads/${userId}/${crypto.randomUUID()}-${filename}`;

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    const uploadUrl = await getSignedUrl(this.s3, command, { expiresIn: 3600 });

    return { uploadUrl, key };
  }

  async getSignedDownloadUrl(key: string): Promise<string> {
    if (!this.s3) {
      throw new BadRequestException('S3 not configured');
    }

    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    return getSignedUrl(this.s3, command, { expiresIn: 3600 });
  }

  isConfigured(): boolean {
    return !!this.s3;
  }
}
