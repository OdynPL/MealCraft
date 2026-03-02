export interface FoodDetail {
  id: number;
  title: string;
  image: string;
  category: string;
  cuisine: string;
  instructions: string;
  sourceUrl?: string;
  youtubeUrl?: string;
  tags: string[];
  author: string;
  createdAt: string;
}
