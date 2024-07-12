import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { CreateBucketCommand, DeleteBucketCommand, ListBucketsCommand } from '@aws-sdk/client-s3';

const config = require('../../../utils/config');

export default async (fastify: FastifyInstance): Promise<void> => {
  fastify.get('/', async (req: FastifyRequest, reply: FastifyReply) => {
    const { s3Client } = config.getS3Config();
    const command = new ListBucketsCommand({});

    try {
      const { Owner, Buckets } = await s3Client.send(command);
      reply.send({
        owner: Owner,
        buckets: Buckets,
      });
    } catch (error) {
      console.error('Error listing buckets', error);
      reply.code(500).send({ error: error.message });
    }
  });

  fastify.post('/', async (req: FastifyRequest, reply: FastifyReply) => {
    const { s3Client } = config.getS3Config();
    const { bucketName } = req.body as any;
    const createBucketCommand = new CreateBucketCommand({
      Bucket: bucketName,
    });

    try {
      const data = await s3Client.send(createBucketCommand);
      reply.send({ message: 'Bucket created successfully', data });
    } catch (error) {
      console.error('Error creating bucket', error);
      reply.code(500).send({ message: error });
    }
  });

  fastify.delete('/:bucketName', async (req: FastifyRequest, reply: FastifyReply) => {
    const { s3Client } = config.getS3Config();
    const { bucketName } = req.params as any;

    const deleteBucketCommand = new DeleteBucketCommand({
      Bucket: bucketName,
    });

    try {
      await s3Client.send(deleteBucketCommand);
      reply.send({ message: 'Bucket deleted successfully' });
    } catch (error) {
      console.error('Error deleting bucket', error);
      reply.code(500).send({ error: error.message });
    }
  });
};
