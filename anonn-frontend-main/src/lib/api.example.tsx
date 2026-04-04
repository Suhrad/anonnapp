/**
 * Example usage of the centralized API hooks
 * 
 * This file demonstrates how to use useApiQuery and useApiMutation
 * in your components. Delete this file if not needed.
 */

import { useApiQuery, useApiMutation } from "@/hooks/useApi";
import type { Post } from "@/types";

// Example 1: GET request with query parameters
export function ExampleQuery() {
  const { data, isLoading, error, refetch: _refetch } = useApiQuery<Post[]>({
    endpoint: "posts",
    queryKey: ["posts", 1, "hot"],
    params: {
      page: 1,
      limit: 20,
      sortBy: "hot",
      time: "day",
    },
  });

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div>
      {data?.map((post) => (
        <div key={post.id}>{post.title}</div>
      ))}
    </div>
  );
}

// Example 2: POST request (create)
export function ExampleCreateMutation() {
  const mutation = useApiMutation({
    endpoint: "posts",
    method: "POST",
    invalidateQueries: [["posts"]], // Refetch posts after creation
  });

  const handleCreate = () => {
    mutation.mutate({
      title: "New Post",
      content: "Post content here",
      communityId: "123",
    });
  };

  return (
    <button onClick={handleCreate} disabled={mutation.isPending}>
      {mutation.isPending ? "Creating..." : "Create Post"}
    </button>
  );
}

// Example 3: PUT request (update)
export function ExampleUpdateMutation() {
  const mutation = useApiMutation({
    endpoint: "posts/123",
    method: "PUT",
    invalidateQueries: [["posts"], ["post", "123"]],
  });

  const handleUpdate = () => {
    mutation.mutate({
      title: "Updated Title",
      content: "Updated content",
    });
  };

  return <button onClick={handleUpdate}>Update</button>;
}

// Example 4: DELETE request
export function ExampleDeleteMutation() {
  const mutation = useApiMutation({
    endpoint: "posts/123",
    method: "DELETE",
    invalidateQueries: [["posts"]],
  });

  const handleDelete = () => {
    mutation.mutate(null as any); // DELETE doesn't need body
  };

  return <button onClick={handleDelete}>Delete</button>;
}

// Example 5: Mutation with body and params
export function ExampleMutationWithParams() {
  const mutation = useApiMutation({
    endpoint: "posts",
    method: "POST",
  });

  const handleSubmit = () => {
    // You can pass body directly
    mutation.mutate({
      title: "New Post",
      content: "Content",
    });

    // Or use the structured format with body and params
    mutation.mutate({
      body: {
        title: "New Post",
        content: "Content",
      },
      params: {
        draft: false,
      },
    } as any);
  };

  return <button onClick={handleSubmit}>Submit</button>;
}

// Example 6: Query with conditional fetching
export function ExampleConditionalQuery() {
  const shouldFetch = true; // Your condition

  const { data: _data } = useApiQuery({
    endpoint: "posts",
    queryKey: ["posts"],
    enabled: shouldFetch, // Only fetch when condition is true
  });

  return <div>{/* Render data */}</div>;
}

