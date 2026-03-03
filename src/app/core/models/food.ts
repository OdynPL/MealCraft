export interface Food {
  id: number;
  title: string;
  image: string;
  imageType: string;
  sourceUrl?: string;
  cuisine: string;
  category: string;
  tags: string[];
  ownerId?: number;
  author: string;
  createdAt: string;
}
