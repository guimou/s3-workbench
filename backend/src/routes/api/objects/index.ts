import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { ListObjectsV2Command, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { Readable } from 'stream';

const config = require('../../../utils/config');

const createRef = (initialValue: any) => {
  return {
    current: initialValue,
  };
};

const abortUploadController = createRef(null);

export default async (fastify: FastifyInstance): Promise<void> => {
  // Get all first-level objects in a bucket (delimiter is /)
  fastify.get('/:bucketName', async (req: FastifyRequest, reply: FastifyReply) => {
    const { s3Client } = config.getConfig();
    const { bucketName } = req.params as any;
    const command = new ListObjectsV2Command({
      Bucket: bucketName,
      Delimiter: '/',
    });
    const { Contents, CommonPrefixes } = await s3Client.send(command);
    reply.send({ objects: Contents, prefixes: CommonPrefixes });
  });

  fastify.get('/:bucketName/:prefix', async (req: FastifyRequest, reply: FastifyReply) => {
    // Get all first-level objects in a bucket under a specific prefix
    const { s3Client } = config.getConfig();
    const { bucketName, prefix } = req.params as any;
    let decoded_prefix = '';
    if (prefix !== undefined) {
      decoded_prefix = atob(prefix);
    }
    const command = new ListObjectsV2Command({
      Bucket: bucketName,
      Prefix: decoded_prefix,
      Delimiter: '/',
    });
    const { Contents, CommonPrefixes } = await s3Client.send(command);
    reply.send({ objects: Contents, prefixes: CommonPrefixes });
  });

  // Get an object to view it in the client
  fastify.get('/view/:bucketName/:encodedKey', async (req: FastifyRequest, reply: FastifyReply) => {
    const { s3Client } = config.getConfig();
    const { bucketName, encodedKey: encodedKey } = req.params as any;
    const key = atob(encodedKey);

    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: key,
    });

    try {
      const item = await s3Client.send(command);
      return item.Body;
    } catch (err) {
      req.log.error(err);
      reply.status(500).send('Error viewing file');
      return reply;
    }
  });

  // Download an object, streaming it to the client
  fastify.get(
    '/download/:bucketName/:encodedKey',
    async (req: FastifyRequest, reply: FastifyReply) => {
      const { s3Client } = config.getConfig();
      const { bucketName, encodedKey } = req.params as any;
      const key = atob(encodedKey);
      const fileName = key.split('/').pop();

      const command = new GetObjectCommand({
        Bucket: bucketName,
        Key: key,
      });

      try {
        const item = await s3Client.send(command);

        const s3Stream = item.Body as Readable;

        // Set the appropriate headers for the response
        reply.header('Content-Disposition', `attachment; filename="${fileName}"`);
        reply.header('Access-Control-Expose-Headers', 'Content-Disposition');
        reply.header('Content-Type', 'application/octet-stream');

        // Pipe the S3 stream to the response
        reply.raw.on('close', () => {
          s3Stream.destroy();
        });

        reply.send(s3Stream);

        return reply;
      } catch (err) {
        req.log.error(err);
        reply.status(500).send('Error downloading file');
        return reply;
      }
    },
  );

  fastify.delete(
    '/:bucketName/:encodedObjectName',
    async (req: FastifyRequest, reply: FastifyReply) => {
      const { s3Client } = config.getConfig();
      const { bucketName, encodedObjectName } = req.params as any;
      const objectName = atob(encodedObjectName);
      const command = new DeleteObjectCommand({
        Bucket: bucketName,
        Key: objectName,
      });
      await s3Client.send(command);
      reply.send({ message: 'Object deleted successfully' });
    },
  );

  // Receive a file from the client and upload it to the bucket
  const uploadProgress = {
    loaded: 0,
    status: 'idle',
  };

  const setUploadProgress = (loaded: number, status: string) => {
    uploadProgress.loaded = loaded;
    uploadProgress.status = status;
  };

  fastify.get('/upload-progress', (req, reply) => {
    reply.raw.setHeader('Access-Control-Allow-Origin', '*');
    reply.raw.setHeader(
      'Access-Control-Allow-Headers',
      'Origin, X-Requested-With, Content-Type, Accept',
    );
    reply.raw.setHeader('Content-Type', 'text/event-stream');
    reply.raw.setHeader('Cache-Control', 'no-cache');
    reply.raw.setHeader('Connection', 'keep-alive');

    const sendEvent = (data: any) => {
      reply.raw.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    const interval = setInterval(() => {
      sendEvent({
        loaded: uploadProgress.loaded,
        status: uploadProgress.status,
      });
      if (uploadProgress.status === 'completed') {
        clearInterval(interval);
        setUploadProgress(0, 'idle');
        reply.raw.end();
      }
    }, 1000);

    // Handle client disconnect
    req.raw.on('close', () => {
      setUploadProgress(0, 'idle');
      clearInterval(interval);
    });
  });

  fastify.get('/abort-upload', (req, reply) => {
    if (abortUploadController.current) {
      abortUploadController.current.abort();
      setUploadProgress(0, 'idle');
      reply.send({ message: 'Upload aborted' });
    } else {
      reply.send({ message: 'No upload to abort' });
    }
  });

  fastify.post(
    '/upload/:bucketName/:encodedKey',
    async (req: FastifyRequest, reply: FastifyReply) => {
      const { s3Client } = config.getConfig();
      const { bucketName, encodedKey } = req.params as any;
      const key = atob(encodedKey);

      const data = await req.file({
        limits: {
          fileSize: 10 * 1024 * 1024 * 1024, // 10Gb limit
        },
      });

      if (!data) {
        reply.status(400).send({ error: 'File not found in request' });
        console.log('File not found in request');
        return;
      }

      const fileStream = data.file;

      abortUploadController.current = new AbortController();

      setUploadProgress(0, 'uploading');

      const target = {
        Bucket: bucketName,
        Key: key,
        Body: fileStream,
      };

      try {
        const upload = new Upload({
          client: s3Client,
          queueSize: 4, // optional concurrency configuration
          leavePartsOnError: false, // optional manually handle dropped parts
          params: target,
          abortController: abortUploadController.current,
        });

        upload.on('httpUploadProgress', (progress) => {
          setUploadProgress(progress.loaded, 'uploading');
        });

        await upload.done();
        setUploadProgress(0, 'completed');
        abortUploadController.current = null;
        reply.send({ message: 'Object uploaded successfully' });
      } catch (e) {
        console.log(e);
        abortUploadController.current = null;
        setUploadProgress(0, 'idle');
      }
    },
  );

  fastify.get(
    '/import/:bucketName/:encodedPrefix/:encodedModelName',
    async (req: FastifyRequest, reply: FastifyReply) => {
      const { bucketName, encodedPrefix, encodedModelName } = req.params as any;
      const prefix = atob(encodedPrefix);
      const modelName = atob(encodedModelName);
      console.log(bucketName, prefix, modelName);
      reply.send({ message: 'Model successfully imported' });
    },
  );
};
