<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Recipe analysis rules (targets, conversions, fixes) live as pure functions in src/lib/recipe-engine.ts with tests beside it — keeps calculations consistent and testable.
- Saved recipes store the full analysis JSON in recipes.nutrition so the library shows exactly what was analysed.
