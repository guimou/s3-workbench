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
};
