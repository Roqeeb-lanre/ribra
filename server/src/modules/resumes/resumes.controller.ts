import type { Request, Response } from 'express';
import { z } from 'zod';
import * as service from './resumes.service.js';

export const analyzeSchema = z.object({
  targetRole: z.string().trim().max(100, 'Keep the target role under 100 characters').optional(),
});

const titleSchema = z.string().trim().max(120).optional();

export async function upload(req: Request, res: Response) {
  const title = titleSchema.parse(req.body?.title);
  const resume = await service.uploadResume(req.auth!.userId, req.file, title);
  res.status(201).json({ resume });
}

export async function list(req: Request, res: Response) {
  res.json({ resumes: await service.listResumes(req.auth!.userId) });
}

export async function remove(req: Request<{ id: string }>, res: Response) {
  await service.deleteResume(req.auth!.userId, req.params.id);
  res.status(204).end();
}

export async function analyze(req: Request<{ id: string }>, res: Response) {
  const { targetRole } = req.body as z.infer<typeof analyzeSchema>;
  const analysis = await service.analyzeResume(
    req.auth!.userId,
    req.params.id,
    targetRole || undefined,
  );
  res.status(201).json({ analysis });
}

export async function listAnalyses(req: Request, res: Response) {
  res.json({ analyses: await service.listAnalyses(req.auth!.userId) });
}

export async function getAnalysis(req: Request<{ id: string }>, res: Response) {
  res.json({ analysis: await service.getAnalysis(req.auth!.userId, req.params.id) });
}
