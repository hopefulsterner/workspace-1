import { Router } from 'express';
import { prisma } from '../utils/prisma';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// Public: Get all extensions
router.get('/', async (req, res) => {
  try {
    const extensions = await prisma.extension.findMany({
      orderBy: { downloads: 'desc' },
    });
    
    res.json({ extensions });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch extensions' });
  }
});

// Public: Get extension by slug
router.get('/:slug', async (req, res) => {
  try {
    const extension = await prisma.extension.findUnique({
      where: { slug: req.params.slug },
    });
    
    if (!extension) {
      return res.status(404).json({ error: 'Extension not found' });
    }
    
    res.json({ extension });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch extension' });
  }
});

// Protected routes
router.use(authMiddleware);

// Get user's installed extensions
router.get('/user/installed', async (req, res) => {
  try {
    const userExtensions = await prisma.userExtension.findMany({
      where: { userId: req.userId },
    });
    
    res.json({ extensions: userExtensions });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch user extensions' });
  }
});

// Install extension
router.post('/install/:extensionId', async (req, res) => {
  try {
    const { extensionId } = req.params;
    
    // Check if already installed
    const existing = await prisma.userExtension.findUnique({
      where: {
        userId_extensionId: {
          userId: req.userId!,
          extensionId,
        },
      },
    });
    
    if (existing) {
      return res.status(400).json({ error: 'Extension already installed' });
    }
    
    // Install
    const userExtension = await prisma.userExtension.create({
      data: {
        userId: req.userId!,
        extensionId,
        enabled: true,
      },
    });
    
    // Update download count
    await prisma.extension.update({
      where: { id: extensionId },
      data: { downloads: { increment: 1 } },
    });
    
    res.status(201).json({ userExtension });
  } catch (error) {
    res.status(500).json({ error: 'Failed to install extension' });
  }
});

// Uninstall extension
router.delete('/uninstall/:extensionId', async (req, res) => {
  try {
    await prisma.userExtension.deleteMany({
      where: {
        userId: req.userId,
        extensionId: req.params.extensionId,
      },
    });
    
    res.json({ message: 'Extension uninstalled' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to uninstall extension' });
  }
});

// Toggle extension
router.patch('/toggle/:extensionId', async (req, res) => {
  try {
    const userExt = await prisma.userExtension.findUnique({
      where: {
        userId_extensionId: {
          userId: req.userId!,
          extensionId: req.params.extensionId,
        },
      },
    });
    
    if (!userExt) {
      return res.status(404).json({ error: 'Extension not installed' });
    }
    
    await prisma.userExtension.update({
      where: { id: userExt.id },
      data: { enabled: !userExt.enabled },
    });
    
    res.json({ enabled: !userExt.enabled });
  } catch (error) {
    res.status(500).json({ error: 'Failed to toggle extension' });
  }
});

export default router;
