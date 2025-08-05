<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    /**
     * Run the migrations.
     *
     * @return void
     */
    public function up()
    {
        Schema::create('contact_debts', function (Blueprint $table) {
            $table->increments('id');
            $table->uuid('contact_uuid')->nullable()->index();
            $table->integer('amount')->nullable() ->default(0);
            $table->date('received_at')->nullable();
            $table->string('note')->nullable();
            $table->softDeletes();
            $table->timestamp('created_at')->nullable()->index();
            $table->timestamp('updated_at')->nullable();
        });
    }

    /**
     * Reverse the migrations.
     *
     * @return void
     */
    public function down()
    {
        Schema::dropIfExists('contact_debts');
    }
};
