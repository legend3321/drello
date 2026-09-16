import { BoardWorkspace } from "@/components/BoardWorkspace";

import styles from "./page.module.css";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function BoardPage({ params }: Props) {
  const { id } = await params;
  const boardId = Number(id);

  if (Number.isNaN(boardId)) {
    return <p>Invalid board id.</p>;
  }

  return (
    <main className={styles.main}>
      <BoardWorkspace boardId={boardId} />
    </main>
  );
}
