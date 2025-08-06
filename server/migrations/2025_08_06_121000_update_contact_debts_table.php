<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // Xóa các cột cũ (nếu có)
        Schema::table('contact_debts', function (Blueprint $table) {
            if (Schema::hasColumn('contact_debts', 'received_at')) {
                $table->dropColumn('received_at');
            }
            if (Schema::hasColumn('contact_debts', 'created_at')) {
                $table->dropColumn('created_at');
            }
            if (Schema::hasColumn('contact_debts', 'updated_at')) {
                $table->dropColumn('updated_at');
            }
        });

        // Thêm lại các cột với kiểu chuẩn
        Schema::table('contact_debts', function (Blueprint $table) {
            $table->dateTime('received_at')->nullable()->after('amount');
            $table->dateTime('created_at')->nullable()->index()->after('note');
            $table->dateTime('updated_at')->nullable()->after('created_at');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('contact_debts', function (Blueprint $table) {
            if (Schema::hasColumn('contact_debts', 'received_at')) {
                $table->dropColumn('received_at');
            }
            if (Schema::hasColumn('contact_debts', 'created_at')) {
                $table->dropColumn('created_at');
            }
            if (Schema::hasColumn('contact_debts', 'updated_at')) {
                $table->dropColumn('updated_at');
            }
        });

        // Thêm lại đúng kiểu cũ (nếu cần rollback)
        Schema::table('contact_debts', function (Blueprint $table) {
            $table->date('received_at')->nullable();
            $table->timestamp('created_at')->nullable()->index();
            $table->timestamp('updated_at')->nullable();
        });
    }
};
