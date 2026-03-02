export interface MealDbDetailDto {
  idMeal: string;
  strMeal: string;
  strCategory: string | null;
  strArea: string | null;
  strInstructions: string | null;
  strMealThumb: string;
  strTags: string | null;
  strYoutube: string | null;
  strSource: string | null;
}

export interface MealDbDetailResponseDto {
  meals: MealDbDetailDto[] | null;
}
