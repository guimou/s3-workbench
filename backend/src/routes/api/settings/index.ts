import { ListBucketsCommand } from '@aws-sdk/client-s3';
import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

const config = require('../../../utils/config');

export default async (fastify: FastifyInstance): Promise<void> => {
  fastify.get('/', async (req: FastifyRequest, reply: FastifyReply) => {
    const { accessKeyId, secretAccessKey, region, endpoint } = config.getConfig();
    const settings = {
      accessKeyId: accessKeyId,
      secretAccessKey: secretAccessKey,
      region: region,
      endpoint: endpoint,
    };
    reply.send({ settings });
  });

  fastify.post('/', async (req: FastifyRequest, reply: FastifyReply) => {
    const { accessKeyId, secretAccessKey, region, endpoint } = req.body as any;
    try {
      config.updateConfig(accessKeyId, secretAccessKey, region, endpoint);
      reply.send({ message: 'Settings updated successfully' });
    } catch (error) {
      console.error('Error updating settings', error);
      reply.code(500).send({ message: error });
    }
  });

  fastify.get('/test', async (req: FastifyRequest, reply: FastifyReply) => {
    const { s3Client } = config.getConfig();
    try {
      await s3Client.send(new ListBucketsCommand({}));
      reply.send({ message: 'Connection successful' });
    } catch (error) {
      console.error('Error testing connection', error);
      reply.code(500).send({ message: error });
    }
  });
};
