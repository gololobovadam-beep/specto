import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FieldLabel } from "./common";

describe("FieldLabel", () => {
  it("does not redirect clicks inside complex field content to nested buttons", () => {
    const onUndo = vi.fn();

    render(
      <FieldLabel label="Content">
        <button type="button" onClick={onUndo}>
          Undo
        </button>
        <div data-testid="editor-workspace">Workspace</div>
      </FieldLabel>
    );

    fireEvent.click(screen.getByTestId("editor-workspace"));

    expect(onUndo).not.toHaveBeenCalled();
  });

  it("keeps explicit label-to-input wiring for simple fields", () => {
    render(
      <FieldLabel label="Title" htmlFor="field-title">
        <input id="field-title" />
      </FieldLabel>
    );

    expect(screen.getByLabelText("Title")).toBe(screen.getByRole("textbox"));
  });
});
