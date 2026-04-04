import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { SvgIcon } from "../SvgIcon";

interface SearchBarProps {
  onSearch?: (query: string) => void;
  placeholder?: string;
  initialValue?: string;
}

export default function SearchBar({
  onSearch,
  placeholder = "Blow the whistle .....",
  initialValue = "",
}: SearchBarProps) {
  const [query, setQuery] = useState(initialValue);

  // Sync local state with initialValue prop when it changes
  useEffect(() => {
    if (initialValue !== undefined) {
      setQuery(initialValue);
    }
  }, [initialValue]);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    onSearch?.(query);
  };

  // 4. This new handler updates the search query on every keystroke
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newQuery = e.target.value;
    setQuery(newQuery); // Update the local input value
  };

  return (
    <div>
      <form
        onSubmit={handleSubmit}
        className="flex flex-col md:flex-row border border-[#525252]/20 overflow-hidden"
      >
        {" "}
        <Input
          type="text"
          placeholder={placeholder}
          value={query}
          onChange={handleChange}
          className="flex-1 text-xs h-8 border-0 font-medium md:h-12 text-[#E8EAE9] placeholder:text-[#525252] focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0 px-4 md:px-9"
        />{" "}
        <Button
          type="submit"
          className="h-8 md:h-12 bg-[#373737] hover:bg-[#606060] text-[#E8EAE9] text-xs font-medium px-4 md:px-8 flex items-center gap-[10px] tracking-wider rounded-none border-0"
        >
          <SvgIcon src="@/icons/Search icon.svg" alt="Search" />
          SEARCH
        </Button>
      </form>{" "}
    </div>
  );
}
