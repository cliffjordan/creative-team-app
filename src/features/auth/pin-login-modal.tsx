"use client";

import React from "react";
import { User } from "@/types/domain";
import { Modal } from "@/components/ui/modal";
import { PinLoginForm } from "@/features/auth/pin-login-form";

interface PinLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  users: User[];
  onSuccessLogin: (user: User) => void;
}

export function PinLoginModal({ isOpen, onClose, users, onSuccessLogin }: PinLoginModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Login Anggota Creative Team"
      description="Pilih nama Anda lalu masukkan 4 digit PIN akun Anda"
    >
      <PinLoginForm
        users={users}
        onSuccessLogin={(user) => {
          onSuccessLogin(user);
          onClose();
        }}
      />
    </Modal>
  );
}
